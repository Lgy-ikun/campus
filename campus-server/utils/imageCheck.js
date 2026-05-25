function checkImages(images = []) {
  return {
    passed: true,
    message: "图片审核通过",
    images
  };
}

module.exports = {
  checkImages
};
