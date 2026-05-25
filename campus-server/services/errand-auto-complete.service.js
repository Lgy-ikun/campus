const errandModel = require("../models/errand.model");

const DEFAULT_INTERVAL_MS = 10 * 60 * 1000;
const DEFAULT_TIMEOUT_HOURS = 24;

let timer = null;
let running = false;

async function runErrandAutoCompleteOnce() {
  if (running) {
    return 0;
  }

  running = true;

  try {
    const updated = await errandModel.autoCompletePendingConfirm(
      Number(process.env.ERRAND_AUTO_COMPLETE_HOURS || DEFAULT_TIMEOUT_HOURS)
    );

    if (updated > 0) {
      console.log(`[errand-auto-complete] auto completed ${updated} order(s)`);
    }

    return updated;
  } catch (error) {
    console.error("[errand-auto-complete] failed", error);
    return 0;
  } finally {
    running = false;
  }
}

function startErrandAutoCompleteJob() {
  if (timer) {
    return;
  }

  runErrandAutoCompleteOnce();

  timer = setInterval(() => {
    runErrandAutoCompleteOnce();
  }, Number(process.env.ERRAND_AUTO_COMPLETE_INTERVAL_MS || DEFAULT_INTERVAL_MS));

  if (typeof timer.unref === "function") {
    timer.unref();
  }
}

module.exports = {
  runErrandAutoCompleteOnce,
  startErrandAutoCompleteJob
};
