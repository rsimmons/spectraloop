'use strict';

var spectraloop = require('./spectraloop');

function loadAudioFile(audioCtx, file, cb) {
  // Prevent any non-audio file type from being read.
  if (!file.type.match(/audio.*/)) {
    console.log('The dropped file is not audio: ', file.type);
    return;
  }

  var reader = new FileReader();
  reader.onload = function(e) {
    audioCtx.decodeAudioData(e.target.result, function(audioBuffer) {
      cb(audioBuffer);
    });
  };
  reader.readAsArrayBuffer(file);
}

document.addEventListener('DOMContentLoaded', function() {
  var AudioContext = window.AudioContext || window.webkitAudioContext;
  var audioCtx = new AudioContext();

  var dropTarget = document;
  dropTarget.addEventListener('dragover', function(e){ e.preventDefault(); }, true);
  dropTarget.addEventListener('drop', function(e) {
    e.preventDefault();

    console.log('Loading input file ...');
    loadAudioFile(audioCtx, e.dataTransfer.files[0], function(audioBuffer) {
      console.log(audioBuffer);

      console.log('Computing spectraloop ...');
      var slBuffer = spectraloop.spectraloop(audioCtx, audioBuffer, 135*44100, 512, 4*44100);
      console.log(slBuffer);

      console.log('Playing ...');
      var bufSrc = audioCtx.createBufferSource();
      bufSrc.buffer = slBuffer;
      bufSrc.loop = true;
      bufSrc.connect(audioCtx.destination);
      bufSrc.start(0);
    });
  }, true);
});
