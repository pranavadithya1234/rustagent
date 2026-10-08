export const processColors = {
  Suspicious: "rgba(255, 165, 0, 0.2)",
  Critical: "rgba(255, 68, 68, 0.2)",
  Normal: "rgba(0, 200, 81, 0.2)",
  System: "rgba(51, 181, 229, 0.2)",
};

export const getReadableProcess = (rawProc) => {
  if (typeof rawProc === "string") return { name: rawProc, pid: "N/A" };
  if (Array.isArray(rawProc) && rawProc.length >= 2) {
    return { name: rawProc[0], pid: rawProc[1], raw: rawProc };
  }
  if (typeof rawProc === "object") {
    return {
      name: rawProc.name || rawProc.executable || "Unknown",
      pid: rawProc.pid || "N/A",
      path: rawProc.path || "",
      raw: rawProc,
    };
  }
  return { name: "Unknown", pid: "N/A" };
};

export const getProcessRows = (processes) => {
  if (!processes || !Array.isArray(processes)) return [];
  return processes.map((p) => {
    const proc = getReadableProcess(p);
    let category = "App";
    const name = proc.name.toLowerCase();
    const path = (proc.path || "").toLowerCase();
    
    // System Classification
    if (
      name.includes("kernel") || 
      name.includes("launchd") || 
      name.includes("system") || 
      name.includes("root") || 
      path.includes("/system/") || 
      path.includes("/sbin/") ||
      path.includes("windows/system32")
    ) {
      category = "System";
    } 
    // Service Classification
    else if (
      name.includes("daemon") || 
      name.includes("service") || 
      name.includes("helper") || 
      path.includes("/library/privilegedhelpertools")
    ) {
      category = "Service";
    }
    // Suspicious Overrides
    if (name.includes("miner") || name.includes("crypt") || name.includes("monero") || name.includes("exploit")) {
      category = "Critical";
    }

    return { ...proc, category };
  });
};

export const formatBytes = (bytes, decimals = 2) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};
