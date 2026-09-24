import { useEffect, useState } from "react";
import { api } from "./api";
import { useAuthStore } from "../store";

/**
 * Today's points for the org's business day (BUG-01) plus the lifetime total.
 * The lifetime `user.points` never resets, so anything labelled as the current
 * day's score must use `pointsToday` from here instead.
 */
export function useTodayPoints() {
  const token = useAuthStore((s) => s.token);
  const [state, setState] = useState({ pointsToday: 0, totalPoints: 0, date: null });

  useEffect(() => {
    if (!token) return undefined;
    let alive = true;
    const load = () =>
      api
        .get("/points/today")
        .then(({ data }) => {
          if (alive) {
            setState({ pointsToday: data.points_today, totalPoints: data.total_points, date: data.date });
          }
        })
        .catch(() => {});

    load();
    window.addEventListener("points-changed", load);
    window.addEventListener("focus", load);
    // also catches the midnight rollover while the tab stays open
    const timer = setInterval(load, 60 * 1000);
    return () => {
      alive = false;
      window.removeEventListener("points-changed", load);
      window.removeEventListener("focus", load);
      clearInterval(timer);
    };
  }, [token]);

  return state;
}
