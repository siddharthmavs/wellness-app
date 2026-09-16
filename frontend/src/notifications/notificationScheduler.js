

import {
  createWellnessNotification,
  sendDesktopNotification,
} from "./notificationService";

/* =========================================================
   STORAGE KEYS
========================================================= */

const WATER_SETTINGS_KEY =
  "wellness-water-settings";

const EYE_SCHEDULE_KEY =
  "eyeBreakSchedule";

const MOVE_SCHEDULE_KEY =
  "moveResetSchedule";

const BREATHING_SCHEDULE_KEY =
  "breathingSchedule";

const NOTIFICATION_SETTINGS_KEY =
  "notificationSettings";

const TRIGGERED_KEY =
  "wellnessNotificationTriggered";

/* =========================================================
   DEFAULT SETTINGS
========================================================= */

const DEFAULT_NOTIFICATION_SETTINGS = {
  notificationsEnabled: true,

  desktopNotifications: true,
  inAppPopup: true,

  water: true,
  eyeCare: true,
  moveReset: true,
  breathe: true,

  sound: true,
};

/* =========================================================
   LOAD NOTIFICATION SETTINGS
========================================================= */

const getNotificationSettings = () => {
  try {
    const saved = localStorage.getItem(
      NOTIFICATION_SETTINGS_KEY
    );

    if (saved) {
      return {
        ...DEFAULT_NOTIFICATION_SETTINGS,
        ...JSON.parse(saved),
      };
    }
  } catch (error) {
    console.error(
      "Failed to load notification settings:",
      error
    );
  }

  return DEFAULT_NOTIFICATION_SETTINGS;
};

/* =========================================================
   LOAD SCHEDULE
========================================================= */

const getSchedule = (type) => {
  try {
    /*
      WATER
    */

    if (type === "water") {
      const saved =
        localStorage.getItem(
          WATER_SETTINGS_KEY
        );

      if (!saved) {
        return [];
      }

      const settings = JSON.parse(saved);

      return Array.isArray(
        settings.reminderTimes
      )
        ? settings.reminderTimes
        : [];
    }

    /*
      EYE CARE
    */

    if (type === "eye_care") {
      const saved =
        localStorage.getItem(
          EYE_SCHEDULE_KEY
        );

      if (!saved) {
        return [];
      }

      const schedule = JSON.parse(saved);

      return Array.isArray(schedule)
        ? schedule
        : [];
    }

    /*
      MOVE & RESET
    */

    if (type === "move_reset") {
      const saved =
        localStorage.getItem(
          MOVE_SCHEDULE_KEY
        );

      if (!saved) {
        return [];
      }

      const schedule = JSON.parse(saved);

      return Array.isArray(schedule)
        ? schedule
        : [];
    }

    /*
      BREATHING
    */

    if (type === "breathing") {
      const saved =
        localStorage.getItem(
          BREATHING_SCHEDULE_KEY
        );

      if (!saved) {
        return [];
      }

      const schedule = JSON.parse(saved);

      return Array.isArray(schedule)
        ? schedule
        : [];
    }
  } catch (error) {
    console.error(
      `Failed to load ${type} schedule:`,
      error
    );
  }

  return [];
};

/* =========================================================
   CHECK IF WELLNESS TYPE IS ENABLED
========================================================= */

const isTypeEnabled = (
  type,
  settings
) => {
  if (!settings.notificationsEnabled) {
    return false;
  }

  switch (type) {
    case "water":
      return settings.water;

    case "eye_care":
      return settings.eyeCare;

    case "move_reset":
      return settings.moveReset;

    case "breathing":
      return settings.breathe;

    default:
      return false;
  }
};

/* =========================================================
   GET TODAY'S DATE KEY
========================================================= */

const getTodayKey = () => {
  const now = new Date();

  const year = now.getFullYear();
  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    now.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

/* =========================================================
   GET CURRENT TIME
========================================================= */

const getCurrentTime = () => {
  const now = new Date();

  return {
    hours: now.getHours(),
    minutes: now.getMinutes(),
  };
};

/* =========================================================
   CHECK WHETHER A SCHEDULE TIME MATCHES
========================================================= */

const isTimeDue = (scheduleTime) => {
  if (!scheduleTime) {
    return false;
  }

  const [hours, minutes] =
    scheduleTime.split(":").map(Number);

  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes)
  ) {
    return false;
  }

  const current =
    getCurrentTime();

  return (
    current.hours === hours &&
    current.minutes === minutes
  );
};

/* =========================================================
   GET TRIGGERED NOTIFICATIONS
========================================================= */

const getTriggeredNotifications = () => {
  try {
    const saved =
      localStorage.getItem(
        TRIGGERED_KEY
      );

    if (!saved) {
      return {};
    }

    return JSON.parse(saved);
  } catch {
    return {};
  }
};

/* =========================================================
   SAVE TRIGGERED NOTIFICATION
========================================================= */

const markAsTriggered = (
  type,
  time
) => {
  const today =
    getTodayKey();

  const triggered =
    getTriggeredNotifications();

  if (!triggered[today]) {
    triggered[today] = {};
  }

  if (!triggered[today][type]) {
    triggered[today][type] = [];
  }

  if (
    !triggered[today][type].includes(time)
  ) {
    triggered[today][type].push(time);
  }

  /*
    Remove old dates so localStorage
    doesn't grow forever.
  */

  const dates =
    Object.keys(triggered);

  dates.forEach((date) => {
    if (date !== today) {
      delete triggered[date];
    }
  });

  localStorage.setItem(
    TRIGGERED_KEY,
    JSON.stringify(triggered)
  );
};

/* =========================================================
   CHECK IF ALREADY TRIGGERED
========================================================= */

const wasAlreadyTriggered = (
  type,
  time
) => {
  const today =
    getTodayKey();

  const triggered =
    getTriggeredNotifications();

  return Boolean(
    triggered?.[today]?.[type]?.includes(
      time
    )
  );
};

/* =========================================================
   CHECK ALL WELLNESS SCHEDULES
========================================================= */

export const checkWellnessNotifications = (
  onNotification
) => {
  const settings =
    getNotificationSettings();

  /*
    Global notifications disabled.
  */

  if (!settings.notificationsEnabled) {
    return;
  }

  const wellnessTypes = [
    "water",
    "eye_care",
    "move_reset",
    "breathing",
  ];

  wellnessTypes.forEach((type) => {
    /*
      Check whether this specific
      wellness reminder is enabled.
    */

    if (
      !isTypeEnabled(
        type,
        settings
      )
    ) {
      return;
    }

    const schedule =
      getSchedule(type);

    if (!schedule.length) {
      return;
    }

    schedule.forEach((time) => {
      /*
        Is this reminder due right now?
      */

      if (!isTimeDue(time)) {
        return;
      }

      /*
        Don't trigger the same reminder
        repeatedly during the same minute.
      */

      if (
        wasAlreadyTriggered(
          type,
          time
        )
      ) {
        return;
      }

      /*
        Mark it BEFORE sending so that
        repeated intervals cannot duplicate it.
      */

      markAsTriggered(
        type,
        time
      );

      /*
        Create notification object enriched with a unique 
        ID and timestamp for in-app popup dismissal handling.
      */

      const baseNotification =
        createWellnessNotification(type);

      const notification = {
        id: `${type}-${Date.now()}`,
        timestamp: Date.now(),
        ...baseNotification,
      };

      /*
        In-app popup.
      */

      if (
        settings.inAppPopup &&
        typeof onNotification ===
          "function"
      ) {
        onNotification(
          notification
        );
      }

      /*
        Desktop notification.
      */

      sendDesktopNotification(
        notification
      );
    });
  });
};

/* =========================================================
   START SCHEDULER
========================================================= */

export const startNotificationScheduler = (
  onNotification
) => {
  /*
    Check immediately.
  */

  checkWellnessNotifications(
    onNotification
  );

  /*
    Check every 15 seconds.

    This means the reminder doesn't
    depend on the user being on the
    exact second.
  */

  const interval = setInterval(() => {
    checkWellnessNotifications(
      onNotification
    );
  }, 15000);

  /*
    Return cleanup function.
  */

  return () => {
    clearInterval(interval);
  };
};