import React, { useCallback, useEffect, useState } from "react";
import { ipcRenderer as ipc } from "electron";
import Select from "react-dropdown-select";

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

  const [includeHillTime, setIncludeHillTime] = useState(true);

  const eventTypeOptions = [
    { label: "Race", value: "race" },
    { label: "Training", value: "training" },
  ];

  const [eventType, setEventType] = useState(
    eventTypeOptions.find(
      (opt) => opt.value === localStorage.getItem("eventType")
    ) || eventTypeOptions[0]
  );

  const selectEventType = useCallback((opt) => {
    localStorage.setItem("eventType", opt.value);
    setEventType(opt);
  }, []);

  const [startLanesURL, setStartLanesURL] = useState(
    localStorage.getItem("startLanesURL") || ""
  );

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
          includeHillTime,
          eventType: eventType.value,
          startLanesURL,
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

  const toggleHillTime = () => {
    const shouldIncludeHillTime = !includeHillTime;
    setIncludeHillTime(shouldIncludeHillTime);

    if (polling) {
      stop();
      start({ includeHillTime: shouldIncludeHillTime });
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

      <div className="formInput">
        <label>Event Type</label>
        <div className="inputGroup">
          <Select
            options={eventTypeOptions}
            onChange={(values) => selectEventType(values[0])}
            values={[eventType]}
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
            checked={includeHillTime}
            onChange={toggleHillTime}
          />
          <div className="slider"></div>
        </label>
        <div>Include hill time</div>
      </div>

      <div className="formInput">
        <label for="weekendRaceId">Start Lanes URL</label>
        <input
          type="url"
          id="weekendRaceId"
          placeholder="Start Lanes URL"
          value={startLanesURL}
          onChange={(e) => {
            setStartLanesURL(e.target.value);
            localStorage.setItem("startLanesURL", e.target.value);
          }}
        />
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
