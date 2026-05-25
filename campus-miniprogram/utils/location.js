function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function hasCoordinate(latitude, longitude) {
  return toNumber(latitude) !== null && toNumber(longitude) !== null;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function calculateDistance(latitude1, longitude1, latitude2, longitude2) {
  const lat1 = toNumber(latitude1);
  const lng1 = toNumber(longitude1);
  const lat2 = toNumber(latitude2);
  const lng2 = toNumber(longitude2);

  if ([lat1, lng1, lat2, lng2].some((item) => item === null)) {
    return null;
  }

  const earthRadius = 6371000;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(deltaLng / 2) *
      Math.sin(deltaLng / 2);

  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(distance) {
  const value = Number(distance);
  if (!Number.isFinite(value) || value < 0) {
    return "";
  }

  if (value < 1000) {
    return `${Math.round(value)}m`;
  }

  if (value < 10000) {
    return `${(value / 1000).toFixed(1)}km`;
  }

  return `${Math.round(value / 1000)}km`;
}

function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    wx.getLocation({
      type: "gcj02",
      success: (result) => {
        resolve({
          latitude: result.latitude,
          longitude: result.longitude
        });
      },
      fail: reject
    });
  });
}

function openLocation(options = {}) {
  const latitude = toNumber(options.latitude);
  const longitude = toNumber(options.longitude);

  if (latitude === null || longitude === null) {
    wx.showToast({
      title: "当前地点坐标不可用",
      icon: "none"
    });
    return;
  }

  wx.openLocation({
    latitude,
    longitude,
    scale: 18,
    name: options.name || options.address || "目标地点",
    address: options.address || ""
  });
}

module.exports = {
  hasCoordinate,
  calculateDistance,
  formatDistance,
  getCurrentLocation,
  openLocation
};
