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

  var offsetInputElem = document.getElementById('offset-input');
  var currentOffsetFrames = 0;
  var currentInputBuffer;
  var currentOutputBufferSource;

  function recomputeLoop() {
    console.log('Computing spectraloop ...');
    var slBuffer = spectraloop.spectraloop(audioCtx, currentInputBuffer, currentOffsetFrames, 8192, 2*44100);
    console.log(slBuffer);

    if (currentOutputBufferSource) {
      currentOutputBufferSource.disconnect();
    }

    console.log('Playing ...');
    var newBufferSource = audioCtx.createBufferSource();
    newBufferSource.buffer = slBuffer;
    newBufferSource.loop = true;
    newBufferSource.connect(audioCtx.destination);
    newBufferSource.start(0);
    currentOutputBufferSource = newBufferSource;
  }

  var dropTarget = document;
  dropTarget.addEventListener('dragover', function(e){ e.preventDefault(); }, true);
  dropTarget.addEventListener('drop', function(e) {
    e.preventDefault();

    console.log('Loading input file ...');
    loadAudioFile(audioCtx, e.dataTransfer.files[0], function(audioBuffer) {
      currentInputBuffer = audioBuffer;
      console.log(currentInputBuffer);

      offsetInputElem.max = audioBuffer.length;
      offsetInputElem.value = 0;
      offsetInputElem.addEventListener('change', function() {
        currentOffsetFrames = (+this.value);
        recomputeLoop();
      }, false);

      recomputeLoop();
    });
  }, true);
});
