
$(document).ready(function() {
  $('body').css('visibility', 'visible');
  var el = document.getElementById('file-uploader');
  var uploader = new qq.FileUploader({
    element: document.getElementById('file-uploader'),
    action: '/upload',
    debug: true,
    extraDropzones: [qq.getByClass(document, 'drop-area')[0]]
  });

});
