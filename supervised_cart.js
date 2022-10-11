var l8Tiwi = ee.ImageCollection('LANDSAT/LC08/C01/T1_TOA')
   .filterDate('2021-07-01', '2022-07-01')
   
   
//   var l8Tiwi2 = ee.ImageCollection('LANDSAT/LC08/C01/T1_SR')
//   .filterDate('2021-07-01', '2022-07-01')
//   .filterBounds(nairobi)
//   .sort('CLOUD_COVER')
//   .first()
// print(l8Tiwi2, 'tiwi2')
 
var visParams = {bands: ['B4', 'B3', 'B2'],min:0.046982601284980774, max: 0.188396155834198};
Map.centerObject(nairobi, 10)
// Map.addLayer(l8Tiwi2.median().clip(nairobi), visParams, 'l8Tiwi2 SR');

var getQABits = function(image, start, end, newName) {
    // Compute the bits we need to extract.
    var pattern = 0;
    for (var i = start; i <= end; i++) {
       pattern += Math.pow(2, i);
    }
    // Return a single band image of the extracted QA bits, giving the band
    // a new name.
    return image.select([0], [newName])
                  .bitwiseAnd(pattern)
                  .rightShift(start);
};

// A function to mask out cloudy pixels.
var cloud_shadows = function(image) {
  // Select the QA band.
  var QA = image.select(['BQA']);
  // Get the internal_cloud_algorithm_flag bit.
  return getQABits(QA, 7,8, 'Cloud_shadows').eq(1);
  // Return an image masking out cloudy areas.
};

// A function to mask out cloudy pixels.
var clouds = function(image) {
  // Select the QA band.
  var QA = image.select(['BQA']);
  // Get the internal_cloud_algorithm_flag bit.
  return getQABits(QA, 4,4, 'Cloud').eq(0);
  // Return an image masking out cloudy areas.
};

var maskClouds = function(image) {
  var cs = cloud_shadows(image);
  var c = clouds(image);
  image = image.updateMask(cs);
  return image.updateMask(c);
};

var nairobiiMasked = l8Tiwi.map(maskClouds).median().clip(nairobi);
print(nairobiiMasked, 'l8TiwiMasked') 

Map.addLayer(nairobiiMasked, visParams, 'nairobiiMasked'); 


// var nairobiiMasked2 = l8Tiwi2.map(maskClouds).median().clip(nairobi);
// print(nairobiiMasked2, 'l8TiwiMasked2') 
// Map.addLayer(nairobiiMasked2, visParams, 'nairobiiMasked2'); 

//start unsupervised classification
//create a training dataset
var training = nairobiiMasked.sample({
  region: nairobi,
  scale: 30,
  numPixels:5000
})


//instantiate the clusterer and train it
var clusterer = ee.Clusterer.wekaKMeans(15).train(training) //unsupevised model


//cluster the input image using the clusterer
var result = nairobiiMasked.cluster(clusterer)
print('result', result.getInfo())

//display the result with random colors
Map.addLayer(result.randomVisualizer(), {}, 'Nairobi Unsupervised Classification')



//NOW LETS DO SUPERVISED CLASSIFICATION
//Come up wit training data
var test_training = water.merge(urban).merge(forest).merge(cropland).merge(bare_land);
print('test training', test_training)

Export.table.toAsset(test_training)

var label = 'Class'
var bands = ['B1', 'B2', 'B3', 'B4', 'B5',  'B7']
var input = nairobiiMasked.select(bands)


//overlay the points on the image to get training
var trainImage = input.sampleRegions({
  collection: test_training,
  properties: [label],
  scale: 30
})

print(trainImage)

//split training data into 80% for classification and 20% for validation
var trainingData = trainImage.randomColumn()
var trainSet = trainingData.filter(ee.Filter.lessThan('random', 0.8))
var testSet = trainingData.filter(ee.Filter.greaterThanOrEquals('random', 0.8))

//Classiication Model
var classifier = ee.Classifier.smileCart().train(trainSet, label, bands)

///classify the image
var classifiedImage = input.classify(classifier)
print(classifiedImage.getInfo())

var landCoverPalette = ['#39f1ff', '#ff0000','#357f0f', '#21ff00', '#cb7f71']

//visualize the clasified image
Map.addLayer(classifiedImage, {palette: landCoverPalette,min:0, max:4}, 'Nairobi Supervised Classification')


//Accuracy assessment
//classify the test set and get the confusion matrix

var confusionMatrix = ee.ConfusionMatrix(testSet.classify(classifier)
.errorMatrix({
  actual:'Class',
  predicted: 'classification'
}))
print(confusionMatrix, 'confusionMatrix')
print('Overall Accuracy', confusionMatrix.accuracy())