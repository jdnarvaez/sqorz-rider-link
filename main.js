"use strict";

// Import parts of electron to use
const { app, BrowserWindow, dialog, shell } = require("electron");
const path = require("path");
const url = require("url");
const fetch = require("node-fetch");
const fs = require("fs");
const csv = require("fast-csv");
const { ipcMain } = require("electron");
const log = require("electron-log");

const GENERIC_PHOTO_URL =
  "https://art-department-usabmx.s3.us-west-1.amazonaws.com/Sqorz+Headshots/NOPHOTO.png";
let polling = false;
let intervalId;
const validPhotoURLs = new Map();

function prependHttp(url, { https = true } = {}) {
  if (typeof url !== "string") {
    throw new TypeError(
      `Expected \`url\` to be of type \`string\`, got \`${typeof url}\``
    );
  }

  url = url.trim();

  if (/^\.*\/|^(?!localhost)\w+?:/.test(url)) {
    return url;
  }

  return url.replace(/^(?!(?:\w+?:)?\/\/)/, https ? "https://" : "http://");
}

// Keep a global reference of the window object, if you don't, the window will
// be closed automatically when the JavaScript object is garbage collected.
let mainWindow;

// Keep a reference for dev mode
let dev = false;

// Broken:
// if (process.defaultApp || /[\\/]electron-prebuilt[\\/]/.test(process.execPath) || /[\\/]electron[\\/]/.test(process.execPath)) {
//   dev = true
// }

if (
  process.env.NODE_ENV !== undefined &&
  process.env.NODE_ENV === "development"
) {
  dev = true;
}

// Temporary fix broken high-dpi scale factor on Windows (125% scaling)
// info: https://github.com/electron/electron/issues/9691
if (process.platform === "win32") {
  app.commandLine.appendSwitch("high-dpi-support", "true");
  app.commandLine.appendSwitch("force-device-scale-factor", "1");
}

function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 700,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });

  // and load the index.html of the app.
  let indexPath;

  if (dev && process.argv.indexOf("--noDevServer") === -1) {
    indexPath = url.format({
      protocol: "http:",
      host: "localhost:3000",
      pathname: "index.html",
      slashes: true,
    });
  } else {
    indexPath = url.format({
      protocol: "file:",
      pathname: path.join(__dirname, "dist", "index.html"),
      slashes: true,
    });
  }

  mainWindow.loadURL(indexPath);

  // Don't show until we are ready and loaded
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();

    // Open the DevTools automatically if developing
    if (dev) {
      const {
        default: installExtension,
        REACT_DEVELOPER_TOOLS,
      } = require("electron-devtools-installer");

      installExtension(REACT_DEVELOPER_TOOLS).catch((err) =>
        log.error("Error loading React DevTools: ", err)
      );
      mainWindow.webContents.openDevTools();
    }
  });

  // Emitted when the window is closed.
  mainWindow.on("closed", function () {
    // Dereference the window object, usually you would store windows
    // in an array if your app supports multi windows, this is the time
    // when you should delete the corresponding element.
    mainWindow = null;
  });
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on("ready", createWindow);

// Quit when all windows are closed.
app.on("window-all-closed", () => {
  // On macOS it is common for applications and their menu bar
  // to stay active until the user quits explicitly with Cmd + Q
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  // On macOS it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (mainWindow === null) {
    createWindow();
  }
});

function parseCSV(file) {
  return new Promise((resolve, reject) => {
    const riders = [];

    fs.createReadStream(path.resolve(file))
      .pipe(csv.parse({ headers: true }))
      .on("error", (error) => reject(error))
      .on("data", (rider) => riders.push(rider))
      .on("end", (rowCount) => resolve(riders));
  });
}

async function mapRider(riders, rider) {
  if (!rider) {
    log.warn(`No rider found in Sqorz JSON Response`);
    return {};
  }

  if (!rider.id) {
    log.warn(`No rider data found in Sqorz JSON Response`);
    return rider;
  }

  // Member_SN -> id
  const transponder_data = riders.find((r) => r.Member_SN === rider.id);

  if (transponder_data) {
    let hometown;

    if (
      transponder_data.CITY &&
      transponder_data.STATE &&
      transponder_data.COUNTRY
    ) {
      hometown = `${transponder_data.CITY}, ${transponder_data.STATE}, ${transponder_data.COUNTRY}`;
    } else if (transponder_data.CITY && transponder_data.STATE) {
      hometown = `${transponder_data.CITY}, ${transponder_data.STATE}`;
    } else if (transponder_data.CITY && transponder_data.COUNTRY) {
      hometown = `${transponder_data.CITY}, ${transponder_data.COUNTRY}`;
    } else if (transponder_data.STATE && transponder_data.COUNTRY) {
      hometown = `${transponder_data.STATE}, ${transponder_data.COUNTRY}`;
    } else {
      hometown =
        transponder_data.CITY ||
        transponder_data.STATE ||
        transponder_data.COUNTRY;
    }

    let photo = prependHttp(
      (transponder_data["PHOTO_LINK"] &&
        transponder_data["PHOTO_LINK"].trim()) ||
        GENERIC_PHOTO_URL
    );

    const validPhoto = validPhotoURLs.get(photo);

    if (validPhoto === false) {
      photo = GENERIC_PHOTO_URL;
    } else if (validPhoto === undefined || validPhoto === null) {
      try {
        const photo_response = await fetch(photo);

        if (photo_response.status !== 200) {
          validPhotoURLs.set(photo, false);
          photo = GENERIC_PHOTO_URL;
        } else {
          validPhotoURLs.set(photo, true);
        }
      } catch (error) {
        log.error(
          `Unable to validate photo URL for rider ${rider.id} ${photo}`
        );
        validPhotoURLs.set(photo, false);
        photo = GENERIC_PHOTO_URL;
      }
    }

    return {
      name: transponder_data.NAME,
      sponsor: transponder_data.SPONSOR,
      hometown,
      photo: photo && photo.trim() != "" ? photo : GENERIC_PHOTO_URL,
    };
  }

  log.warn(
    `Unable to find rider information for ${rider.name} ID ${rider.id} in CSV`
  );

  return {
    name: rider.name,
    photo: GENERIC_PHOTO_URL,
  };
}

async function parseStateLanes(outputFile, startLanesURL, ascending = true) {
  if (!startLanesURL) {
    return;
  }

  try {
    let url;
    let races;

    try {
      url = new URL(startLanesURL);
      const response = await fetch(startLanesURL);
      races = await response.json();
    } catch (e1) {
      try {
        races = JSON.parse(fs.readFileSync(path.resolve(startLanesURL)));
      } catch (err) {
        return;
      }
    }

    const csv = [
      [
        "raceName",
        "className",
        "riders_lane",
        "riders_Name",
        "riders_plate",
        "riders_countryCode",
        "Flag_url",
      ].join(","),
      ...races
        .sort(
          (a, b) =>
            a.Moto_Number - b.Moto_Number ||
            (ascending
              ? a.Lane_Number - b.Lane_Number
              : b.Lane_Number - a.Lane_Number)
        )
        .map(
          ({
            First_Name: givenName,
            Lane_Number: lane,
            Last_Name: familyName,
            Bike_Number: plate,
            Country_IOC_3: countryCode,
            Class_Name: className,
            Moto_Number: raceName,
          }) => {
            return [
              `${raceName}`,
              `${className}`,
              `${lane}`,
              `${givenName} ${familyName}`,
              `${plate}`,
              `${countryCode}`,
              `https://art-department-usabmx.s3.us-west-1.amazonaws.com/country_flags/${countryCode}.png`,
            ].join(",");
          }
        ),
    ].join("\n");

    fs.writeFileSync(path.resolve(outputFile, `Start_Lanes.csv`), csv);
  } catch (err) {
    console.error(err);
  }
}

async function poll(opts) {
  try {
    if (!polling) {
      return;
    }

    const {
      riders,
      raceID,
      weekendRaceID,
      outputFile,
      includeSectorTime,
      includeHillTime,
      eventType = "combined",
      startLanesURL,
      startLanesAscending,
      numberOfTopRiders = 3,
    } = opts;

    let classes = [
      "Men Pro",
      "Women Pro",
      "Vet Pro",
      "Girl Cruiser",
      "Cruiser",
      "Novice",
      "Intermediate",
      "Girls Expert",
      "Expert",
      "Flat Girls",
      "Flat Boys",
      "Overall Women",
      "Overall Men",
    ];

    if (includeSectorTime) {
      classes = [
        ...classes,
        "Sector Time Women",
        "Sector Time Men",
        "Sector Overall Men",
        "Sector Overall Women",
        "Sector Male Flats",
        "Sector Female Flats",
      ];
    }

    if (includeHillTime) {
      classes = [
        ...classes,
        "Hill Time Male",
        "Hill Time Female",
        "Hill Time Flats Male",
        "Hill Time Flats Female",
      ];
    }

    fs.mkdirSync(outputFile, { recursive: true });

    const fetchTimingData = async ({ raceID, ...params }) => {
      const base = `https://our.sqorz.com/json/leaderboard/${raceID}/usabmx`;
      const searchParams = new URLSearchParams();

      Object.entries(params).forEach(([key, value]) => {
        searchParams.set(key, value);
      });

      const url = `${base}?${searchParams.toString()}`;

      return fetch(url, {
        headers: { accept: "application/json" },
      })
        .then(async (r) => {
          if (!r.headers.get("content-type")?.includes("json")) {
            const msg = await r.text();
            throw new Error(`Unable to retrieve ${url} \r\n ${msg}`);
          }

          return r.json();
        })
        .catch((e) => {
          console.error(e);
          return [];
        });
    };

    let requests = [
      fetchTimingData({ raceID, eventType, proficiencyCode: "A" }),
      fetchTimingData({ raceID, eventType, proficiencyCode: "Z" }),
      fetchTimingData({ raceID, eventType, proficiencyCode: "V" }),
      fetchTimingData({ raceID, eventType, proficiencyCode: "H" }),
      fetchTimingData({ raceID, eventType, proficiencyCode: "C" }),
      fetchTimingData({ raceID, eventType, proficiencyCode: "N" }),
      fetchTimingData({ raceID, eventType, proficiencyCode: "I" }),
      fetchTimingData({ raceID, eventType, proficiencyCode: "G" }),
      fetchTimingData({ raceID, eventType, proficiencyCode: "E" }),
      fetchTimingData({
        raceID,
        eventType,
        gender: "female",
        minAge: "5",
        maxAge: "12",
      }),
      fetchTimingData({
        raceID,
        eventType,
        gender: "male",
        minAge: "5",
        maxAge: "12",
      }),
      fetchTimingData({ raceID: weekendRaceID, eventType, gender: "female" }),
      fetchTimingData({ raceID: weekendRaceID, eventType, gender: "male" }),
    ];

    if (includeSectorTime) {
      requests = [
        ...requests,
        fetchTimingData({
          raceID: weekendRaceID,
          eventType: "combined",
          gender: "female",
          sortBy: "sectorTime",
        }),
        fetchTimingData({
          raceID: weekendRaceID,
          eventType: "combined",
          gender: "male",
          sortBy: "sectorTime",
        }),
        fetchTimingData({
          raceID,
          eventType: "combined",
          gender: "male",
          sortBy: "sectorTime",
        }),
        fetchTimingData({
          raceID,
          eventType: "combined",
          gender: "female",
          sortBy: "sectorTime",
        }),
        fetchTimingData({
          raceID,
          eventType: "combined",
          gender: "male",
          sortBy: "sectorTime",
          maxAge: "12",
        }),
        fetchTimingData({
          raceID,
          eventType: "combined",
          gender: "female",
          sortBy: "sectorTime",
          maxAge: "12",
        }),
      ];
    }

    if (includeHillTime) {
      requests = [
        ...requests,
        fetchTimingData({
          raceID: weekendRaceID,
          eventType: "combined",
          gender: "male",
          sortBy: "hillTime",
        }),
        fetchTimingData({
          raceID: weekendRaceID,
          eventType: "combined",
          gender: "female",
          sortBy: "hillTime",
        }),
        fetchTimingData({
          raceID: weekendRaceID,
          eventType: "combined",
          gender: "male",
          sortBy: "hillTime",
          maxAge: "12",
        }),
        fetchTimingData({
          raceID: weekendRaceID,
          eventType: "combined",
          gender: "female",
          sortBy: "hillTime",
          maxAge: "12",
        }),
      ];
    }

    const responses = await Promise.all(requests);

    responses.forEach((response, idx) => {
      const data = response.map((r) => {
        const { id, ...props } = r;
        return { ...props };
      });

      fs.writeFileSync(
        path.resolve(outputFile, `${classes[idx].replaceAll(" ", "_")}.json`),
        JSON.stringify(data)
      );
    });

    const top_riders = [];

    for (let idx = 0; idx < responses.length; idx++) {
      const response = responses[idx];
      const current_top_riders = response.slice(0, numberOfTopRiders);
      const group = [];

      for (let rider of current_top_riders) {
        const mapped = await mapRider(riders, rider);
        group.push({ ...mapped, class: classes[idx] });
      }

      if (group.length === 0) {
        group.push({
          class: classes[idx],
        });
      }

      top_riders.push(group);
    }

    try {
      fs.writeFileSync(
        path.resolve(outputFile, "top_riders.json"),
        JSON.stringify(top_riders.flat())
      );
    } catch (err) {
      log.error(err);
    }

    await parseStateLanes(outputFile, startLanesURL, startLanesAscending);

    intervalId = setTimeout(() => poll(opts), 10 * 1000);
  } catch (err) {
    log.error(err);
    intervalId = setTimeout(() => poll(opts), 10 * 1000);
  }
}

async function startPoll(event, arg) {
  clearTimeout(intervalId);
  polling = true;
  const riders = await parseCSV(arg.riderCSVFile);
  const opts = { ...arg, riders };
  poll(opts);
}

ipcMain.on("start-poll", startPoll);

ipcMain.on("stop-poll", (event, arg) => {
  polling = false;
  validPhotoURLs.clear();
  clearTimeout(intervalId);
});

ipcMain.on("select-directory", (event, arg) => {
  dialog.showOpenDialog({ properties: ["openDirectory"] }).then((response) => {
    if (!response.canceled) {
      mainWindow.webContents.send("select-directory", response.filePaths[0]);
    }
  });
});

ipcMain.on("select-csv", (event, arg) => {
  dialog.showOpenDialog({ properties: ["openFile"] }).then((response) => {
    if (!response.canceled) {
      mainWindow.webContents.send("select-csv", response.filePaths[0]);
    }
  });
});

ipcMain.on("show-log", () => {
  shell.openPath(path.join(app.getPath("logs"), "main.log"));
});
