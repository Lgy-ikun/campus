const { uploadImage } = require("../../utils/upload");
const { logImageError } = require("../../utils/image");

Component({
  properties: {
    images: {
      type: Array,
      value: []
    },
    maxCount: {
      type: Number,
      value: 20
    },
    maxSizeMb: {
      type: Number,
      value: 5
    }
  },
  data: {
    uploading: false
  },
  methods: {
    chooseImage() {
      if (this.data.uploading) {
        return;
      }

      const currentImages = Array.isArray(this.data.images) ? this.data.images.slice() : [];
      const remainingCount = this.data.maxCount - currentImages.length;

      if (remainingCount <= 0) {
        wx.showToast({
          title: `最多上传${this.data.maxCount}张图片`,
          icon: "none"
        });
        return;
      }

      wx.chooseMedia({
        count: Math.min(9, remainingCount),
        mediaType: ["image"],
        success: async (res) => {
          const tempFiles = res.tempFiles || [];
          const filePaths = tempFiles
            .map((item) => item.tempFilePath)
            .filter(Boolean);

          if (!filePaths.length) {
            return;
          }

          const maxSizeMb = Number(this.data.maxSizeMb || 0);
          if (maxSizeMb > 0) {
            const oversizeFile = tempFiles.find((item) => {
              const size = Number(item.size || 0);
              return size > maxSizeMb * 1024 * 1024;
            });

            if (oversizeFile) {
              wx.showToast({
                title: `上传的图片不能大于${maxSizeMb}MB`,
                icon: "none"
              });
              return;
            }
          }

          const files = currentImages.slice();

          this.setData({
            uploading: true
          });
          this.triggerEvent("uploadingchange", {
            uploading: true
          });

          try {
            for (const filePath of filePaths) {
              const uploadResult = await uploadImage(filePath);
              files.push(uploadResult);
            }

            this.triggerEvent("change", {
              files
            });
          } catch (error) {
            if (files.length !== currentImages.length) {
              this.triggerEvent("change", {
                files
              });
            }

            wx.showToast({
              title: error.message || "图片上传失败",
              icon: "none"
            });
          } finally {
            this.setData({
              uploading: false
            });
            this.triggerEvent("uploadingchange", {
              uploading: false
            });
          }
        }
      });
    },
    handleRemove(event) {
      if (this.data.uploading) {
        return;
      }

      const index = Number(event.currentTarget.dataset.index);
      const images = Array.isArray(this.data.images) ? this.data.images.slice() : [];

      if (Number.isNaN(index) || index < 0 || index >= images.length) {
        return;
      }

      images.splice(index, 1);

      this.triggerEvent("change", {
        files: images
      });
    },
    handleImageError(event) {
      logImageError("image-upload", event);
    }
  }
});
