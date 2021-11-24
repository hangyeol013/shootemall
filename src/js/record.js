import socket from './websocket';

let mediaRecorder;
let recordedBlobs;

const codecPreferences = document.querySelector('#codecPreferences');

const errorMsgElement = document.querySelector('span#errorMsg');
const recordedVideo = document.querySelector('video#recorded');
const recordButton = document.querySelector('button#record');

const canvas = document.getElementById('canvas');
const screenshotButton = document.getElementById('screenshot');

var width = 0, height = 0;

screenshotButton.addEventListener('click', function(ev){
  takepicture();
  ev.preventDefault();
}, false);
const screenshottedImg = document.getElementById('screenshotted');

recordButton.addEventListener('click', () => {
  if (recordButton.textContent === 'Start Recording') {
    startRecording();
  } else {
    stopRecording();
    recordButton.textContent = 'Start Recording';
    playButton.disabled = false;
    uploadButton.disabled = false;
    codecPreferences.disabled = false;
  }
});

const playButton = document.querySelector('button#play');
playButton.addEventListener('click', () => {
  const mimeType = codecPreferences.options[codecPreferences.selectedIndex].value.split(';', 1)[0];
  const superBuffer = new Blob(recordedBlobs, {type: mimeType});
  recordedVideo.src = null;
  recordedVideo.srcObject = null;
  recordedVideo.src = window.URL.createObjectURL(superBuffer);
  recordedVideo.controls = true;
  recordedVideo.play();
});

const uploadButton = document.querySelector('button#upload');
uploadButton.addEventListener('click', () => {
  const blob = new Blob(recordedBlobs, {type: 'video/webm'});
  const fileReader = new FileReader();
  fileReader.onload = function(event) {
      const buffer = event.target.result;

      const m = 262144, n = (buffer.byteLength+m-1) / m
      console.log(`${buffer.byteLength} n=${n}`)

      for(let i = 0; i < n; i++)
        socket.emit('chunk', buffer.slice(i*m, Math.min(i*m+m, buffer.byteLength)))
      socket.emit('upload-video');
  };
  fileReader.readAsArrayBuffer(blob);
});

function handleDataAvailable(event) {
  console.log('handleDataAvailable', event);
  if (event.data && event.data.size > 0) {
    recordedBlobs.push(event.data);
  }
}

function getSupportedMimeTypes() {
  const possibleTypes = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm;codecs=h264,opus',
    'video/mp4;codecs=h264,aac',
  ];
  return possibleTypes.filter(mimeType => {
    return MediaRecorder.isTypeSupported(mimeType);
  });
}

function startRecording() {
  recordedBlobs = [];
  const mimeType = codecPreferences.options[codecPreferences.selectedIndex].value;
  const options = {mimeType};

  try {
    mediaRecorder = new MediaRecorder(window.stream, options);
  } catch (e) {
    console.error('Exception while creating MediaRecorder:', e);
    errorMsgElement.innerHTML = `Exception while creating MediaRecorder: ${JSON.stringify(e)}`;
    return;
  }

  console.log('Created MediaRecorder', mediaRecorder, 'with options', options);
  recordButton.textContent = 'Stop Recording';
  playButton.disabled = true;
  uploadButton.disabled = true;
  codecPreferences.disabled = true;
  mediaRecorder.onstop = (event) => {
    console.log('Recorder stopped: ', event);
    console.log('Recorded Blobs: ', recordedBlobs);
  };
  mediaRecorder.ondataavailable = handleDataAvailable;
  mediaRecorder.start();
  console.log('MediaRecorder started', mediaRecorder);
}

function stopRecording() {
  mediaRecorder.stop();
}

function dataURLtoBlob(dataurl) {
  var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
      bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
  while(n--){
      u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], {type:mime});
}

function takepicture() {
  const gumVideo = document.querySelector('video#gum');

  var context = canvas.getContext('2d');
  canvas.width = width
  canvas.height = height
  context.drawImage(gumVideo, 0, 0, width, height);

  var data = canvas.toDataURL('image/png');
  canvas.width = 0
  canvas.height = 0
  screenshottedImg.setAttribute('src', data);

  data = dataURLtoBlob(data);
  socket.emit('upload-screenshot', data);
  console.log('took screenshot:', data.length)
}

function handleSuccess(stream) {
  recordButton.disabled = false;
  console.log('getUserMedia() got stream:', stream);
  window.stream = stream;

  const gumVideo = document.querySelector('video#gum');
  gumVideo.srcObject = stream;

  getSupportedMimeTypes().forEach(mimeType => {
    const option = document.createElement('option');
    option.value = mimeType;
    option.innerText = option.value;
    codecPreferences.appendChild(option);
  });
  codecPreferences.disabled = false;

  gumVideo.addEventListener('canplay', function(ev){
    //canvas.setAttribute('width', gumVideo.videoWidth);
    //canvas.setAttribute('height', gumVideo.videoHeight);
    width = gumVideo.videoWidth;
    height = gumVideo.videoHeight;
    console.log('width:', width, "height:", height);
  });
}

async function init(constraints) {
  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    handleSuccess(stream);
  } catch (e) {
    console.error('navigator.getUserMedia error:', e);
    errorMsgElement.innerHTML = `navigator.getUserMedia error:${e.toString()}`;
  }
}

document.querySelector('button#start').addEventListener('click', async () => {
  document.querySelector('button#start').disabled = true;
  const constraints = {
    audio: false, 
    video: {
      video: { "mandatory": { "depth": "aligned"}},
      //width: 1280, height: 720,
      facingMode: 'environment'
    }
  };
  console.log('Using media constraints:', constraints);
  await init(constraints);

});
