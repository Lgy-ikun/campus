const mapApi = require("../../api/map");

const DEFAULT_LOCATION = {
  latitude: 39.90923,
  longitude: 116.397428
};

function buildLocationPayload(address, latitude, longitude) {
  return {
    address: address || "",
    latitude: latitude || "",
    longitude: longitude || ""
  };
}

function toNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function hasCoordinate(value) {
  return value !== undefined && value !== null && value !== "";
}

function getMapState(value = {}) {
  const hasPoint = hasCoordinate(value.latitude) && hasCoordinate(value.longitude);
  const latitude = toNumber(value.latitude, DEFAULT_LOCATION.latitude);
  const longitude = toNumber(value.longitude, DEFAULT_LOCATION.longitude);

  return {
    mapLatitude: latitude,
    mapLongitude: longitude,
    markers: hasPoint
      ? [
          {
            id: 1,
            latitude,
            longitude,
            title: value.address || "已选位置",
            width: 28,
            height: 28
          }
        ]
      : []
  };
}

Component({
  options: {
    addGlobalClass: true
  },
  properties: {
    value: {
      type: Object,
      value: {}
    },
    title: {
      type: String,
      value: "地址信息"
    },
    placeholder: {
      type: String,
      value: "请输入地址关键词"
    }
  },
  data: {
    keyword: "",
    loading: false,
    locating: false,
    mapLatitude: DEFAULT_LOCATION.latitude,
    mapLongitude: DEFAULT_LOCATION.longitude,
    markers: [],
    poiList: []
  },
  observers: {
    value(value) {
      this.syncMapState(value || {});
    }
  },
  lifetimes: {
    attached() {
      this.syncMapState(this.properties.value || {});
    }
  },
  methods: {
    syncMapState(value) {
      this.setData({
        keyword: value.address || "",
        ...getMapState(value)
      });
    },
    emitChange(payload) {
      this.syncMapState(payload);
      this.triggerEvent("change", payload);
    },
    onAddressInput(event) {
      const address = event.detail.value;
      this.emitChange(buildLocationPayload(address, this.properties.value.latitude, this.properties.value.longitude));
    },
    async handleSearch() {
      const keyword = String(this.data.keyword || "").trim();

      if (!keyword) {
        wx.showToast({
          title: "请输入地址关键词",
          icon: "none"
        });
        return;
      }

      this.setData({
        loading: true
      });

      try {
        const list = await mapApi.poiSearch({ keyword });
        this.setData({
          poiList: list || []
        });
      } catch (error) {
        this.setData({
          poiList: []
        });
        wx.showToast({
          title: "搜索失败，请稍后重试",
          icon: "none"
        });
      } finally {
        this.setData({
          loading: false
        });
      }
    },
    async handleUseCurrentLocation() {
      if (this.data.locating) {
        return;
      }

      this.setData({
        locating: true
      });

      try {
        const location = await new Promise((resolve, reject) => {
          wx.getLocation({
            type: "gcj02",
            success: resolve,
            fail: reject
          });
        });

        const regeo = await mapApi.regeo({
          latitude: location.latitude,
          longitude: location.longitude
        });

        const payload = buildLocationPayload(
          regeo.formatted_address || this.properties.value.address,
          String(location.latitude),
          String(location.longitude)
        );

        this.setData({
          poiList: []
        });
        this.emitChange(payload);
      } catch (error) {
        wx.showToast({
          title: "定位失败，请手动选择",
          icon: "none"
        });
      } finally {
        this.setData({
          locating: false
        });
      }
    },
    handleChooseOnMap() {
      wx.chooseLocation({
        latitude: this.data.mapLatitude,
        longitude: this.data.mapLongitude,
        success: (result) => {
          const address = result.name || result.address || "地图选点";
          const payload = buildLocationPayload(address, String(result.latitude), String(result.longitude));

          this.setData({
            poiList: []
          });
          this.emitChange(payload);
        },
        fail: () => {
          wx.showToast({
            title: "没有选择位置",
            icon: "none"
          });
        }
      });
    },
    async handleMapTap(event) {
      const latitude = event.detail.latitude;
      const longitude = event.detail.longitude;

      if (!hasCoordinate(latitude) || !hasCoordinate(longitude)) {
        return;
      }

      let address = this.properties.value.address || "地图选点";

      try {
        const regeo = await mapApi.regeo({ latitude, longitude });
        address = regeo.formatted_address || address;
      } catch (error) {
        // 逆地址失败时仍保留手动选点结果。
      }

      this.setData({
        poiList: []
      });
      this.emitChange(buildLocationPayload(address, String(latitude), String(longitude)));
    },
    handleSelectPoi(event) {
      const { address, location } = event.currentTarget.dataset;
      const [longitude = "", latitude = ""] = String(location || "").split(",");
      const payload = buildLocationPayload(address, latitude, longitude);

      this.setData({
        poiList: []
      });
      this.emitChange(payload);
    }
  }
});
