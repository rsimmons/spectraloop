'use strict';

function upsampleArray(inArray, outArray) {
  var dIn = (inArray.length-1)/(outArray.length-1);
  var inPos = 0;
  for (var i = 0; i < outArray.length; i++) {
    var in0 = Math.min(Math.floor(inPos), inArray.length-2); // The min() clamps to make sure end matches up perfectly
    var in1 = in0 + 1;
    var frac = inPos - in0;

    outArray[i] = (1.0 - frac)*inArray[in0] + frac*inArray[in1];

    inPos += dIn;
  }
}

function downsampleArray(inArray, outArray) {
  var dIn = inArray.length/outArray.length;
  var inPos = 0;
  for (var i = 0; i < outArray.length; i++) {
    var nextInPos = inPos + dIn;
    var ind0 = Math.ceil(inPos);
    var ind1 = Math.floor(nextInPos);

    var denom = 0;
    if (ind0 > inPos) {
      var width = ind0 - inPos;
      outArray[i] = width*inArray[ind0-1];
      denom += width;
    }
    for (var j = ind0; j < ind1; j++) {
      outArray[i] += inArray[j];
      denom += 1;
    }
    var width = nextInPos - ind1;
    outArray[i] += width*inArray[ind1];
    denom += width;

    outArray[i] /= denom;

    inPos = nextInPos;
  }
}

function resampleArray(inArray, outArray) {
  if (inArray.length < outArray.length) {
    upsampleArray(inArray, outArray);
  } else if (inArray.length > outArray.length) {
    downsampleArray(inArray, outArray);
  } else {
    for (var i = 0; i < inArray.length; i++) {
      outArray[i] = inArray[i];
    }
  }
}

module.exports = {
  resampleArray: resampleArray,
};
