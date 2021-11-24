var cv = require('opencv.js');
//var jpeg = require('jpeg-js');
var PNG = require('png-js');
var fs = require('fs');

// function read_bw_jpg(filename) {
//     const jpeg_data = fs.readFileSync(filename);
//     const raw_data = jpeg.decode(jpeg_data);
     
//     Create a matrix from image. input image expected to be in RGBA format
//     let src = cv.matFromImageData(raw_data);
//     cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY); // Convert to grayscale
//     return src;
// }

async function read_bw_png(filename) {
    const data = fs.readFileSync(filename);
    var myimage = new PNG(data);

    var width  = myimage.width;
    var height = myimage.height;

    console.log(width, height)
    let raw_data = 0;
    await myimage.decode(function (pixels) {
        //Pixels is a 1D array containing pixel data
        raw_data = pixels;

    });
    let src = cv.matFromImageData(raw_data);
    cv.cvtColor(src, src, cv.COLOR_RGBA2GRAY); // Convert to grayscale
    //console.log(src);
    return src;
}

imgL = read_bw_png('output/recordings/screen1.png')
imgR = read_bw_png('output/recordings/screen2.png')


stereo = cv.StereoBM(numDisparities=16, blockSize=15)
disparity = stereo.compute(imgL,imgR)

cv.imwrite('output/recordings/imgL.png', imgL)
cv.imwrite('output/recordings/imgR.png', imgL)
cv.imwrite('output/recordings/disparity.png', disparity)
 