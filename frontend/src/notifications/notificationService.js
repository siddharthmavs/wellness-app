// src/notifications/notificationService.js

/* =========================================================
   NOTIFICATION CONTENT
========================================================= */

const NOTIFICATION_CONTENT = {
  water: {
    title: "💧 Time to Drink Water",
    message: "Stay hydrated! Take a moment to drink some water.",
  },

  eye_care: {
    title: "👁️ Time for an Eye Break",
    message: "Give your eyes a little rest. Look away from the screen.",
  },

  move_reset: {
    title: "🏃 Time to Move & Reset",
    message: "Stand up, stretch, and give your body a quick reset.",
  },

  breathing: {
    title: "💨 Time to Breathe",
    message: "Take a few minutes to slow down and focus on your breathing.",
  },
};

/* =========================================================
   GET NOTIFICATION CONTENT
========================================================= */

export const getNotificationContent = (type) => {
  return (
    NOTIFICATION_CONTENT[type] || {
      title: "🌱 Wellness Reminder",
      message: "It's time for a quick wellness break.",
    }
  );
};

/* =========================================================
   SEND DESKTOP NOTIFICATION
========================================================= */

export const sendDesktopNotification = ({
  type,
  title,
  message,
}) => {
  /*
    Browser does not support notifications.
  */

  if (
    typeof window === "undefined" ||
    typeof Notification === "undefined"
  ) {
    return;
  }

  /*
    Permission has not been granted.
  */

  if (Notification.permission !== "granted") {
    return;
  }

  /*
    Read global notification settings.
  */

  let settings = {
    notificationsEnabled: true,
    desktopNotifications: true,
    sound: true,
  };

  try {
    const saved = localStorage.getItem(
      "notificationSettings"
    );

    if (saved) {
      settings = {
        ...settings,
        ...JSON.parse(saved),
      };
    }
  } catch (error) {
    console.error(
      "Failed to read notification settings:",
      error
    );
  }

  /*
    Global notifications disabled.
  */

  if (!settings.notificationsEnabled) {
    return;
  }

  /*
    Desktop notifications disabled.
  */

  if (!settings.desktopNotifications) {
    return;
  }

  /*
    Send browser notification.
  */

  try {
    const notification = new Notification(
      title,
      {
        body: message,
        icon: "/favicon.ico",
        tag: `wellness-${type}`,
      }
    );

    /*
      When clicked, bring the Wellness Garden
      window to the front.
    */

    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (error) {
    console.error(
      "Failed to send desktop notification:",
      error
    );
  }
};

/* =========================================================
   CREATE WELLNESS NOTIFICATION
========================================================= */

export const createWellnessNotification = (type) => {
  const content =
    getNotificationContent(type);

  return {
    type,
    title: content.title,
    message: content.message,
  };
};