(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var resample = require('./resample');
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

function renderWaveform(canvasElem, audioBuffer) {
  var width = canvasElem.parentNode.clientWidth
  canvasElem.width = width;
  var height = canvasElem.height;

  var sumSqrSamples = new Float32Array(audioBuffer.length); // sum of squares of sample values across all channels
  for (var i = 0; i < audioBuffer.numberOfChannels; i++) {
    var samples = audioBuffer.getChannelData(i);
    for (var j = 0; j < audioBuffer.length; j++) {
      sumSqrSamples[j] += samples[j]*samples[j];
    }
  }
  var foo = new Float32Array(width);
  resample.resampleArray(sumSqrSamples, foo);

  var ctx = canvasElem.getContext('2d');
  ctx.fillStyle = 'black';
  ctx.fillRect(0, 0, canvasElem.width, canvasElem.height);
  ctx.fillStyle = 'white';
  for (var i = 0; i < width; i++) {
    var h = Math.abs(Math.sqrt(foo[i])*height);
    ctx.fillRect(i, 0.5*(height-h), 1, h);
  }
}

document.addEventListener('DOMContentLoaded', function() {
  var AudioContext = window.AudioContext || window.webkitAudioContext;
  var audioCtx = new AudioContext();

  var inputWaveformElem = document.getElementById('input-waveform');
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

      renderWaveform(inputWaveformElem, audioBuffer);

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

},{"./resample":4,"./spectraloop":5}],2:[function(require,module,exports){
'use strict';

!function(exports, undefined) {

  var
    // If the typed array is unspecified, use this.
    DefaultArrayType = Float32Array,
    // Simple math functions we need.
    sqrt = Math.sqrt,
    sqr = function(number) {return Math.pow(number, 2)},
    // Internal convenience copies of the exported functions
    isComplexArray,
    ComplexArray

  exports.isComplexArray = isComplexArray = function(obj) {
    return obj !== undefined &&
      obj.hasOwnProperty !== undefined &&
      obj.hasOwnProperty('real') &&
      obj.hasOwnProperty('imag')
  }

  exports.ComplexArray = ComplexArray = function(other, opt_array_type){
    if (isComplexArray(other)) {
      // Copy constuctor.
      this.ArrayType = other.ArrayType
      this.real = new this.ArrayType(other.real)
      this.imag = new this.ArrayType(other.imag)
    } else {
      this.ArrayType = opt_array_type || DefaultArrayType
      // other can be either an array or a number.
      this.real = new this.ArrayType(other)
      this.imag = new this.ArrayType(this.real.length)
    }

    this.length = this.real.length
  }

  ComplexArray.prototype.toString = function() {
    var components = []

    this.forEach(function(c_value, i) {
      components.push(
        '(' +
        c_value.real.toFixed(2) + ',' +
        c_value.imag.toFixed(2) +
        ')'
      )
    })

    return '[' + components.join(',') + ']'
  }

  // In-place mapper.
  ComplexArray.prototype.map = function(mapper) {
    var
      i,
      n = this.length,
      // For GC efficiency, pass a single c_value object to the mapper.
      c_value = {}

    for (i = 0; i < n; i++) {
      c_value.real = this.real[i]
      c_value.imag = this.imag[i]
      mapper(c_value, i, n)
      this.real[i] = c_value.real
      this.imag[i] = c_value.imag
    }

    return this
  }

  ComplexArray.prototype.forEach = function(iterator) {
    var
      i,
      n = this.length,
      // For consistency with .map.
      c_value = {}

    for (i = 0; i < n; i++) {
      c_value.real = this.real[i]
      c_value.imag = this.imag[i]
      iterator(c_value, i, n)
    }
  }

  ComplexArray.prototype.conjugate = function() {
    return (new ComplexArray(this)).map(function(value) {
      value.imag *= -1
    })
  }

  // Helper so we can make ArrayType objects returned have similar interfaces
  //   to ComplexArrays.
  function iterable(obj) {
    if (!obj.forEach)
      obj.forEach = function(iterator) {
        var i, n = this.length

        for (i = 0; i < n; i++)
          iterator(this[i], i, n)
      }

    return obj
  }

  ComplexArray.prototype.magnitude = function() {
    var mags = new this.ArrayType(this.length)

    this.forEach(function(value, i) {
      mags[i] = sqrt(sqr(value.real) + sqr(value.imag))
    })

    // ArrayType will not necessarily be iterable: make it so.
    return iterable(mags)
  }
}(typeof exports === 'undefined' && (this.complex_array = {}) || exports)

},{}],3:[function(require,module,exports){
'use strict';

!function(exports, complex_array) {

  var
    ComplexArray = complex_array.ComplexArray,
    // Math constants and functions we need.
    PI = Math.PI,
    SQRT1_2 = Math.SQRT1_2,
    sqrt = Math.sqrt,
    cos = Math.cos,
    sin = Math.sin

  ComplexArray.prototype.FFT = function() {
    return FFT(this, false)
  }

  exports.FFT = function(input) {
    return ensureComplexArray(input).FFT()
  }

  ComplexArray.prototype.InvFFT = function() {
    return FFT(this, true)
  }

  exports.InvFFT = function(input) {
    return ensureComplexArray(input).InvFFT()
  }

  // Applies a frequency-space filter to input, and returns the real-space
  // filtered input.
  // filterer accepts freq, i, n and modifies freq.real and freq.imag.
  ComplexArray.prototype.frequencyMap = function(filterer) {
    return this.FFT().map(filterer).InvFFT()
  }

  exports.frequencyMap = function(input, filterer) {
    return ensureComplexArray(input).frequencyMap(filterer)
  }

  function ensureComplexArray(input) {
    return complex_array.isComplexArray(input) && input ||
        new ComplexArray(input)
  }

  function FFT(input, inverse) {
    var n = input.length

    if (n & (n - 1)) {
      return FFT_Recursive(input, inverse)
    } else {
      return FFT_2_Iterative(input, inverse)
    }
  }

  function FFT_Recursive(input, inverse) {
    var
      n = input.length,
      // Counters.
      i, j,
      output,
      // Complex multiplier and its delta.
      f_r, f_i, del_f_r, del_f_i,
      // Lowest divisor and remainder.
      p, m,
      normalisation,
      recursive_result,
      _swap, _real, _imag

    if (n === 1) {
      return input
    }

    output = new ComplexArray(n, input.ArrayType)

    // Use the lowest odd factor, so we are able to use FFT_2_Iterative in the
    // recursive transforms optimally.
    p = LowestOddFactor(n)
    m = n / p
    normalisation = 1 / sqrt(p)
    recursive_result = new ComplexArray(m, input.ArrayType)

    // Loops go like O(n Σ p_i), where p_i are the prime factors of n.
    // for a power of a prime, p, this reduces to O(n p log_p n)
    for(j = 0; j < p; j++) {
      for(i = 0; i < m; i++) {
        recursive_result.real[i] = input.real[i * p + j]
        recursive_result.imag[i] = input.imag[i * p + j]
      }
      // Don't go deeper unless necessary to save allocs.
      if (m > 1) {
        recursive_result = FFT(recursive_result, inverse)
      }

      del_f_r = cos(2*PI*j/n)
      del_f_i = (inverse ? -1 : 1) * sin(2*PI*j/n)
      f_r = 1
      f_i = 0

      for(i = 0; i < n; i++) {
        _real = recursive_result.real[i % m]
        _imag = recursive_result.imag[i % m]

        output.real[i] += f_r * _real - f_i * _imag
        output.imag[i] += f_r * _imag + f_i * _real

        _swap = f_r * del_f_r - f_i * del_f_i
        f_i = f_r * del_f_i + f_i * del_f_r
        f_r = _swap
      }
    }

    // Copy back to input to match FFT_2_Iterative in-placeness
    // TODO: faster way of making this in-place?
    for(i = 0; i < n; i++) {
      input.real[i] = normalisation * output.real[i]
      input.imag[i] = normalisation * output.imag[i]
    }

    return input
  }

  function FFT_2_Iterative(input, inverse) {
    var
      n = input.length,
      // Counters.
      i, j,
      output, output_r, output_i,
      // Complex multiplier and its delta.
      f_r, f_i, del_f_r, del_f_i, temp,
      // Temporary loop variables.
      l_index, r_index,
      left_r, left_i, right_r, right_i,
      // width of each sub-array for which we're iteratively calculating FFT.
      width

    output = BitReverseComplexArray(input)
    output_r = output.real
    output_i = output.imag
    // Loops go like O(n log n):
    //   width ~ log n; i,j ~ n
    width = 1
    while (width < n) {
      del_f_r = cos(PI/width)
      del_f_i = (inverse ? -1 : 1) * sin(PI/width)
      for (i = 0; i < n/(2*width); i++) {
        f_r = 1
        f_i = 0
        for (j = 0; j < width; j++) {
          l_index = 2*i*width + j
          r_index = l_index + width

          left_r = output_r[l_index]
          left_i = output_i[l_index]
          right_r = f_r * output_r[r_index] - f_i * output_i[r_index]
          right_i = f_i * output_r[r_index] + f_r * output_i[r_index]

          output_r[l_index] = SQRT1_2 * (left_r + right_r)
          output_i[l_index] = SQRT1_2 * (left_i + right_i)
          output_r[r_index] = SQRT1_2 * (left_r - right_r)
          output_i[r_index] = SQRT1_2 * (left_i - right_i)
          temp = f_r * del_f_r - f_i * del_f_i
          f_i = f_r * del_f_i + f_i * del_f_r
          f_r = temp
        }
      }
      width <<= 1
    }

    return output
  }

  function BitReverseIndex(index, n) {
    var bitreversed_index = 0

    while (n > 1) {
      bitreversed_index <<= 1
      bitreversed_index += index & 1
      index >>= 1
      n >>= 1
    }
    return bitreversed_index
  }

  function BitReverseComplexArray(array) {
    var n = array.length,
        flips = {},
        swap,
        i

    for(i = 0; i < n; i++) {
      var r_i = BitReverseIndex(i, n)

      if (flips.hasOwnProperty(i) || flips.hasOwnProperty(r_i)) continue

      swap = array.real[r_i]
      array.real[r_i] = array.real[i]
      array.real[i] = swap

      swap = array.imag[r_i]
      array.imag[r_i] = array.imag[i]
      array.imag[i] = swap

      flips[i] = flips[r_i] = true
    }

    return array
  }

  function LowestOddFactor(n) {
    var factor = 3,
        sqrt_n = sqrt(n)

    while(factor <= sqrt_n) {
      if (n % factor === 0) return factor
      factor = factor + 2
    }
    return n
  }

}(
  typeof exports === 'undefined' && (this.fft = {}) || exports,
  typeof require === 'undefined' && (this.complex_array) ||
    require('./complex_array')
)

},{"./complex_array":2}],4:[function(require,module,exports){
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

},{}],5:[function(require,module,exports){
'use strict';

var resample = require('./resample');
require('jsfft/lib/fft'); // This seems dumb, but need to do this for ComplexArray to get FFT method
var ComplexArray = require('jsfft/lib/complex_array').ComplexArray;

function blackmanHarris(length) {
  var result = new Float32Array(length);

  var a0 = 0.35875;
  var a1 = 0.48829;
  var a2 = 0.14128;
  var a3 = 0.01168;

  for (var i = 0; i < length; i++) {
    var piFrac = Math.PI*i/length;
    result[i] = a0 - a1*Math.cos(2*piFrac) + a2*Math.cos(4*piFrac) - a3*Math.cos(6*piFrac);
  }

  return result;
}

function spectraloopArray(inArray, outArray) {
  if ((inArray & 1) || (outArray & 1)) {
    throw new Error('Input and output arrays should be of even size');
  }

  var inLength = inArray.length;
  var halfInLength = inArray.length/2;
  var outLength = outArray.length;
  var halfOutLength = outArray.length/2;

  // Create window (TODO: cache this?)
  var window = blackmanHarris(inLength);

  // Create complex array as input to FFR
  var windowedComplexIn = new ComplexArray(inLength);

  // Apply window as we write in to complex array, only real components
  for (var i = 0; i < inLength; i++) {
    windowedComplexIn.real[i] = window[i]*inArray[i];
  }

  // Do the FFT
  var freqComplex = windowedComplexIn.FFT();

  // Make array to store the magnitudes of frequencies we care about.
  // Index 0 is DC offset. Indexes 1 to length/2 inclusive will be
  // positive frequencies up to Nyquist freq
  var freqMags = new Float32Array(halfInLength);

  // Compute the magnitudes for the frequencies we care about.
  // Note that we skip the first index, which is DC offset
  for (var i = 0; i < halfInLength; i++) {
    var re = freqComplex.real[i+1];
    var im = freqComplex.imag[i+1];
    freqMags[i] = Math.sqrt(re*re + im*im);
  }

  // Resample amplitude/magnitude data, i.e. "stretch" them
  var resampledFreqMags = new Float32Array(halfOutLength);

  resample.resampleArray(freqMags, resampledFreqMags);

  // Create new complex array for resampled freq data
  var resampledFreqComplex = new ComplexArray(outLength);

  // Fill output complex freq array by rotating magnitudes by random phases
  for (var i = 0; i < halfOutLength; i++) {
    var theta = 2*Math.PI*Math.random();
    resampledFreqComplex.real[i+1] = resampledFreqMags[i]*Math.cos(theta);
    resampledFreqComplex.imag[i+1] = resampledFreqMags[i]*Math.sin(theta);
  }

  // Set DC offset to 0
  resampledFreqComplex.real[0] = 0;
  resampledFreqComplex.imag[0] = 0;

  // Fill in remaining missing complex frequency data to make it Hermitian-symmetric
  for (var i = halfOutLength+1; i < outLength; i++) {
    var mirrorIdx = outLength - i;
    // Complex conjugate
    resampledFreqComplex.real[i] = resampledFreqComplex.real[mirrorIdx];
    resampledFreqComplex.imag[i] = -resampledFreqComplex.imag[mirrorIdx];
  }

  // Do inverse FFT
  var complexOut = resampledFreqComplex.InvFFT();

  // Copy to final ouput array, skipping imag component
  // TODO: is there not a method to do this copy?
  for (var i = 0; i < outLength; i++) {
    outArray[i] = complexOut.real[i];
  }

  // Output may have gotten louder in some points, exceeding [-1.0, 1.0].
  // Check for that and normalize if so
  var absPeak = 0;
  for (var i = 0; i < outLength; i++) {
    var av = Math.abs(outArray[i]);
    if (av > absPeak) {
      absPeak = av;
    }
  }
  console.log('absPeak', absPeak);

  var PEAK_LIMIT = 0.999; // Go a little under 1 just in case it gets rounded wrong later
  // if (absPeak > PEAK_LIMIT) {
  // TODO: always normalize? could take flag
  if (true) {
    var scale = PEAK_LIMIT/absPeak;
    for (var i = 0; i < outLength; i++) {
      outArray[i] *= scale;
    }
  }

  return outArray;
}

function spectraloop(audioCtx, inBuffer, inOffset, inFrames, outFrames) {
  if ((inOffset + inFrames) > inBuffer.length) {
    throw new Error('Specified range exceeds buffer length');
  }

  var outBuffer = audioCtx.createBuffer(inBuffer.numberOfChannels, outFrames, inBuffer.sampleRate);
  for (var channel = 0; channel < inBuffer.numberOfChannels; channel++) {
    var inSamples = inBuffer.getChannelData(channel).slice(inOffset, inOffset+inFrames);
    var outSamples = outBuffer.getChannelData(channel);
    spectraloopArray(inSamples, outSamples);
  }

  return outBuffer;
}

module.exports = {
  spectraloop: spectraloop,
};

},{"./resample":4,"jsfft/lib/complex_array":2,"jsfft/lib/fft":3}]},{},[1]);
