// This code is adapted from
// https://rawgit.com/Miguelao/demos/master/mediarecorder.html

'use strict';

import './css/main.css';
//import './js/record';
//import './js/depth';
//import './js/test_animated_zombie';
import './js/ar2';

// Webpack
// Needed for Hot Module Replacement
if(typeof(module.hot) !== 'undefined') {
  module.hot.accept() // eslint-disable-line no-undef
}