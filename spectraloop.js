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
