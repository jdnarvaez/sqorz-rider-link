import React, { useCallback, useEffect, useState } from "react";
import { ipcRenderer as ipc } from "electron";

import "./Form.css";

const Form = () => {
  const [polling, setPolling] = useState(false);
  const [raceID, setRaceID] = useState(localStorage.getItem("raceID") || "");
  const [weekendRaceID, setWeekendRaceID] = useState(
    localStorage.getItem("weekendRaceID") || ""
  );

  const [riderCSVFile, setRiderCSVFile] = useState(
    localStorage.getItem("riderCSVFile") || ""
  );
  const [outputFile, setOutputFile] = useState(
    localStorage.getItem("outputFile") || ""
  );
  const [includeSectorTime, setIncludeSectorTime] = useState(true);

  useEffect(() => {
    const selectDirectory = (event, args) => {
      setOutputFile(args);
    };

    const selectCSV = (event, args) => {
      setRiderCSVFile(args);
    };

    ipc.on("select-directory", selectDirectory);
    ipc.on("select-csv", selectCSV);

    return () => {
      ipc.removeListener("select-directory", selectDirectory);
      ipc.removeListener("select-csv", selectCSV);
    };
  }, []);

  const start = (opts) => {
    setPolling(true);
    ipc.send(
      "start-poll",
      Object.assign(
        {
          raceID,
          weekendRaceID,
          riderCSVFile,
          outputFile,
          includeSectorTime,
        },
        opts
      )
    );
  };

  const stop = () => {
    setPolling(false);
    ipc.send("stop-poll", "");
  };

  const browseForRiderCSV = () => {
    ipc.send("select-csv", "");
  };

  const browseForOutputDirectory = () => {
    ipc.send("select-directory", "");
  };

  const toggleSectorTime = () => {
    const shouldIncludeSectorTime = !includeSectorTime;
    setIncludeSectorTime(shouldIncludeSectorTime);

    if (polling) {
      stop();
      start({ includeSectorTime: shouldIncludeSectorTime });
    }
  };

  return (
    <div className="appForm">
      <div className="formInput">
        <label for="raceId">Race ID</label>
        <input
          id="raceId"
          type="url"
          placeholder="Race ID"
          value={raceID}
          onChange={(e) => {
            setRaceID(e.target.value);
            localStorage.setItem("raceID", e.target.value);
          }}
        />
      </div>

      <div className="formInput">
        <label for="weekendRaceId">Weekend Race ID</label>
        <input
          type="url"
          id="weekendRaceId"
          placeholder="Weekend Race ID"
          value={weekendRaceID}
          onChange={(e) => {
            setWeekendRaceID(e.target.value);
            localStorage.setItem("weekendRaceID", e.target.value);
          }}
        />
      </div>

      <div className="formInput">
        <label for="riderCSVFile">Rider CSV File</label>
        <div className="inputGroup">
          <button onClick={browseForRiderCSV}>Choose CSV</button>
          <input
            type="text"
            id="riderCSVFile"
            placeholder="Rider CSV File"
            value={riderCSVFile}
            onChange={(e) => {
              setRiderCSVFile(e.target.value);
              localStorage.setItem("riderCSVFile", e.target.value);
            }}
          />
        </div>
      </div>

      <div className="formInput">
        <label for="outputFile">Output JSON Directory</label>
        <div className="inputGroup">
          <button onClick={browseForOutputDirectory}>Choose Directory</button>
          <input
            type="text"
            id="outputFile"
            placeholder="Output JSON Directory"
            value={outputFile}
            onChange={(e) => {
              setOutputFile(e.target.value);
              localStorage.setItem("outputFile", e.target.value);
            }}
          />
        </div>
      </div>

      <div
        className="formInput"
        style={{
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <label className="switch">
          <input
            type="checkbox"
            checked={includeSectorTime}
            onChange={toggleSectorTime}
          />
          <div className="slider"></div>
        </label>
        <div>Include sector time</div>
      </div>

      <div className="buttons">
        <button onClick={() => start()} disabled={polling}>
          Start
        </button>
        <button onClick={stop} disabled={!polling}>
          Stop
        </button>
        <button onClick={() => ipc.send("show-log", "")}>View Log</button>
      </div>
    </div>
  );
};

export default Form;
