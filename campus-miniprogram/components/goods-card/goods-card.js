const { logImageError } = require("../../utils/image");

Component({
  properties: {
    item: {
      type: Object,
      value: {}
    }
  },
  methods: {
    handleImageError(event) {
      logImageError("goods-card", event);
    }
  }
});
