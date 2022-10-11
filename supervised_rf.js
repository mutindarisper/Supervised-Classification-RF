// A Sentinel-2 surface reflectance image, reflectance bands selected,
// serves as the source for training and prediction in this contrived example.
// var img = ee.Image('COPERNICUS/S2_SR/20210109T185751_20210109T185931_T10SEG')
//               .select('B.*');
var s2 = ee.ImageCollection("COPERNICUS/S2_SR")
              
              
var rgbVis = {
  min: 0,
  max: 3000,
  bands: ['B4', 'B3', 'B2']
}

var filtered = s2.filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30))
                  .filterBounds(geometry)
                  .filterDate('2020-01-01', '2020-12-31')
                  
var image = filtered.median().clip(geometry)

Map.addLayer(image, rgbVis, 'image')
Map.centerObject(geometry, 12)



// ESA WorldCover land cover map, used as label source in classifier training.
var lc = ee.Image('ESA/WorldCover/v100/2020');

// Remap the land cover class values to a 0-based sequential series.
var classValues = [10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 100];
var remapValues = ee.List.sequence(0, 10);
// print( 'class values', classValues)
// print('remap values', remapValues)
var label = 'lc';
lc = lc.remap(classValues, remapValues).rename(label).toByte();
// print( 'lc', lc.getInfo().properties.Map_class_names)
// print( 'lc properties', lc.propertyNames())

var lulc_class_names = lc.getInfo().properties.Map_class_names
print(lulc_class_names, 'lulc object names')




// // Add land cover as a band of the reflectance image and sample 100 pixels at
// // 10 m scale from each land cover class within a region of interest.
// var roi = ee.Geometry.Rectangle(-122.347, 37.743, -122.024, 37.838);
var sample = image.addBands(lc).stratifiedSample({
  numPoints: 100,
  classBand: label,
  region: geometry,
  scale: 15,
  geometries: true
});

// // Add a random value field to the sample and use it to approximately split 80%
// // of the features into a training set and 20% into a validation set.
sample = sample.randomColumn();
var trainingSample = sample.filter('random <= 0.8');
var validationSample = sample.filter('random > 0.8');

// // Train a 10-tree random forest classifier from the training sample.
var trainedClassifier = ee.Classifier.smileRandomForest(10).train({
  features: trainingSample,
  classProperty: label,
  inputProperties: image.bandNames()
});

// // Get information about the trained classifier.
print('Results of trained classifier', trainedClassifier.explain());

// // Get a confusion matrix and overall accuracy for the training sample.
var trainAccuracy = trainedClassifier.confusionMatrix();
print('Training error matrix', trainAccuracy);
print('Training overall accuracy', trainAccuracy.accuracy());

// // Get a confusion matrix and overall accuracy for the validation sample.
validationSample = validationSample.classify(trainedClassifier);
var validationAccuracy = validationSample.errorMatrix(label, 'classification');
print('Validation error matrix', validationAccuracy);
print('Validation accuracy', validationAccuracy.accuracy());

// // Classify the reflectance image from the trained classifier.
var imgClassified = image.classify(trainedClassifier);

// // Add the layers to the map.
var classVis = {
  min: 0,
  max: 10,
  palette: ['006400' ,'ffbb22', 'ffff4c', 'f096ff', 'fa0000', 'b4b4b4',
            'f0f0f0', '0064c8', '0096a0', '00cf75', 'fae6a0']
};
// Map.setCenter(-122.184, 37.796, 12);
// Map.addLayer(img, {bands: ['B11', 'B8', 'B3'], min: 100, max: 3500}, 'img');
// Map.addLayer(lc, classVis, 'lc');
Map.addLayer(imgClassified, classVis, 'Classified');
// Map.addLayer(roi, {color: 'white'}, 'ROI', false, 0.5);
Map.addLayer(trainingSample, {color: 'black'}, 'Training sample', false);
Map.addLayer(validationSample, {color: 'magenta'}, 'Validation sample', false);


//================================ADD LEGEND ======================================


var legend = ui.Panel({
  style: {
    position: 'bottom-left',
    padding: '8px 15px'
  }});
  
  // Create legend title
var legendTitle = ui.Label({
  value: 'LULC Classes',
  style: {fontWeight: 'bold',
    fontSize: '18px',
    margin: '0 0 4px 0',
    padding: '0'
    }});
    
    // Add the title to the panel
legend.add(legendTitle);

// Creates and styles 1 row of the legend.
var makeRow = function(color, name) {
 
      // Create the label that is actually the colored box.
      var colorBox = ui.Label({
        style: {
          backgroundColor: '#' + color,
          // Use padding to give the box height and width.
          padding: '8px',
          margin: '0 0 4px 0'
        }});
 
      // Create the label filled with the description text.
      var description = ui.Label({
        value: name,
        style: {margin: '0 0 4px 6px'}
      });
 
      // return the panel
      return ui.Panel({
        widgets: [colorBox, description],
        layout: ui.Panel.Layout.Flow('horizontal')
      })};
      
      //  Palette with the colors
var palette = classVis.palette;
      
      
    // name of the legend

var names = lulc_class_names
 
// Add color and and names
for (var i = 0; i < 11; i++) {
  legend.add(makeRow(palette[i], names[i]));
  }  
 
// add legend to map (alternatively you can also print the legend to the console)
Map.add(legend); 