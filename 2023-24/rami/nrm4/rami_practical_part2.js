           /////////////////////////////////////////////////////////////////////////////
            //                        RAMI Practical Part 2                            //
            //                     Radar Mining Monitoring Tool                        //
            //                                                                         // 
            //                   SERVIR Science Coordination Office                    // 
            //                      Curriculum Development Team                        // 
            //                            Micky Maganini                               //
            //                        Contact: mrm0065@uah.edu                         //
            //                                                                         //
            //              Prepared for "Environmental Monitoring and Modelling       //
            //                 for Natural Resources Management" at ITC                //
            //                         Quartile 4 2023-2024                            //
            //                                                                         //
            /////////////////////////////////////////////////////////////////////////////

// This code is intended to be run in the Google Earth Engine Code Editor (Javascript Interface), which can be found at the following link:
// https://code.earthengine.google.com/

// This Google Earth Engine script serves as supplementary material to RAMI 
// Module 3, which can be found at the following link:
// https://docs.google.com/document/d/1WIodVv51L3GSZziFHSmuhzWii_CqTNcbx512lLK6cKA/edit?usp=sharing

// This Module follows the exact same workflow we used in Script_1, except this time you will try the algorithm 
// over your own area of interest. In attempting to translate this algorithm to a new area of interest, keep in 
// mind what we learned in Module 2. Ask yourself: What does RAMI rely on to detect change? How might the circumstances in your area 
// of interest be different from the Madre de Dios region we looked at in Part 1 of the practical?

// The first part of this code will have variables that you can change to use the RAMI algorithm over your region of interest, and 
// tune the algorithm to this region. Read the instructions carefully to change the variables and fix any errors that you may get when 
// transferring the algorithm to a new area of interest. 

// Step 1: Make a Copy of this notebook. 
// - To make a copy of this notebook, highlight all of the text in the notebook by clicking and dragging. 
// - Then, towards the top left of the interface, click the red button that says "New". 
// - Click "File". 
// - Choose a repository in which to host your script, then give it a name. 
// - Paste the code into your new file. 
// - Close out of the window containing the script you copied the text from. 
// - Continue with the exercise in the script where you pasted the text to. 


// Step 2: Specify your region of interest. 

// We will specify our area of interest using the Geometry tools available in GEE. 
// In the top left of the map interface, there is a logo with a polgyon as well as a logo with a rectangle. 
// The polygon tool will help you to draw a complex polygon, where the rectangle tool will draw a rectangle. 
// 
// - Navigate to your area of interest in the GEE map by clicking and dragging, and zooming in and out. 
// - Draw an area of interest on the map using either the rectangle or the polygon tool. 
// - You can then click the checkbox next to the text that says "Geometry" towards the top left of the map interface 
// to turn the visualization for this layer off. 

// Click "Run" towards the top of the interface. Turn off all the layers except for 
// "Area of Interest" and "Sentinel_first". MAKE SURE THAT ALL OF THE AREA OF INTEREST FALLS WITHIN THE SENTINEL-1 
// SCENE. This will help us avoid feeding different Sentinel scenes to our change detection algorithm which would cause false positives

// Step 3: Specify your time period of interest

// Change the dates below to fit your time period of interest. The first date in the list will be the start date, 
// and the second date in the list will be the end date. The dates must be in 'YYYY-MM-dd' format. Note 
// that the dates must be recent dates, as Sentinel-1 began acquiring imagery in April of 2014.

//  If the console says you have an image collection of 0 elements, that means that there are no Sentinel-1 Float 
// Images for the time period, region of interest, and orbitpass you specified. You can troubleshoot this by trying the following: 
// - Change the orbitpass used. Some regions appear to not have either ascending or descending images 
// - Make sure you entered a valid time period (i.e. the end date occurs after the start date).

// If the console says that you have exceeded your user memory limit, that means you are using too large of an image collection. 
// Try to limit the image collection to a maximum of 50 images to avoid this image. You can see how many images are in your 
// time series by looking at the console and seeing how many elements are in the "get Mosaic Collection" image collection.

var listOfDates = ['2021-01-01', '2021-06-01']; 

// Step 4: Specify the orbit pass of interest. If you want to use descending imagery, you can leave the code is and skip this step. 
// If you want to use descending imagery, comment out line 57 by adding two slashes before it and uncomment line 56 by deleting the two slashes before it. 

var orbitPass = 'ASCENDING'
//var orbitPass = 'DESCENDING'

// Step 5: Tune the Algorithm. 

// Click The Run button at the top of the program. You can tune the algorithm by changing 
// the significance and median values to be given to the omnibus q-test algorithm. Since we do not expect deforestation 
// to occurr across our entire study area, we expect most of the smap image to be black, with a few spots of color. 
// Recall that even though the smap image may appear totally black when you first run the script, you may have to zoom in to elicit

// The signifcance parameter controls how large of a difference between two SAR pixels is needed for the algorithm to flag it as a change. 
// If you think the algorithm is overpredicting deforestation (i.e. you think too much of the smap image is colored), decrease the significance parameter. 
// If you think the algorithm is underpredicting deforestation (i.e. too much of the image is appearing as black), increase the significance paarameter.
// Set the median parameter to be false instead of true if you do not wish to use a median reducer.
var significance = 1e-4; 
var median = true; 

// Step 6: Tune the postprocessing steps
var min_area = 1e4        // The minimum area, in square meters to be considered as a valid deforestation alert
var max_size = 200        // The maximum pixel size to be considered

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//                                            DO NOT CHANGE ANY CODE BELOW                                               //
///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////
//    Section 1: Pre-processing, Time Period and Region of Interest       //
////////////////////////////////////////////////////////////////////////////


// Center the map at the study region 
Map.centerObject(geometry, 9); 

var aoi = ee.FeatureCollection(geometry);
var empty = ee.Image().byte(); 
var aoiOutline = empty.paint({
  featureCollection: geometry,
  color: 1, 
  width: 2
}); 

Map.setOptions('SATELLITE'); 
Map.addLayer(aoiOutline, {
  palette: 'red'
}, 'Area of Study'); 

function maskAngle(image) {
  var angleMask = image.select('angle'); 
  return image.updateMask(angleMask.gte(31).and(angleMask.lte(45))); 
}

function getCollection(dates, roi, orbitPass0) {
  var sarCollFloat = ee.ImageCollection("COPERNICUS/S1_GRD_FLOAT")
      .filterBounds(roi)
      .filterDate(dates[0], dates[1])
      .filter(ee.Filter.eq('orbitProperties_pass', orbitPass0)); 
  return sarCollFloat.map(maskAngle).select(['VV', 'VH'])
}
var sarImageColl = getCollection(listOfDates, aoi, orbitPass); 

print('SAR Image Collection', sarImageColl) 

var first = sarImageColl.first().log10().multiply(10.0)

var vp = {
  'bands': ['VV'], 
  'min': -25, 
  'max': 0
};

Map.addLayer(first, vp, 'sentinel_first')

function getDates(dd) {
  return ee.Date(dd).format('YYYY-MM-dd');
}

function mosaicSAR(dates1) {
  dates1 = ee.Date(dates1); 
  var imageFilt = sarImageColl
        .filterDate(dates1, dates1.advance(1, 'day')); 
  return imageFilt.mosaic()
        .clip(geometry)
        .set({
          'system:time_start': dates1.millis(), 
          'dateYMD': dates1.format('YYYY-MM-dd')
        });
}

////////////////////////////////////////////////////////////////////////////
//                Section 2: Apply Change Detection                     //
////////////////////////////////////////////////////////////////////////////

// Function to get a SAR Collection of mosaics per date. 
var datesMosaic = ee.List(sarImageColl
        .aggregate_array('system:time_start'))
      .map(getDates)
      .distinct();
      
var getMosaicList = datesMosaic.map(mosaicSAR); 
var getMosaicColl = ee.ImageCollection(getMosaicList); 

print('get Mosaic Collection', getMosaicColl);

var omb = require(
  'projects/gee-edu/book:Part A - Applications/A1 - Human Applications/A1.8 Monitoring Gold Mining Activity Using SAR/modules/omnibusTest_v1.1'
);

var util = require(
'projects/gee-edu/book:Part A - Applications/A1 - Human Applications/A1.8 Monitoring Gold Mining Activity Using SAR/modules/utilities_v1.1'
);
var countDates = datesMosaic.size().getInfo(); 

var result = ee.Dictionary(omb.omnibus(getMosaicList, significance, median)); 

print('result', result)

var smap = ee.Image(result.get('smap')).byte(); 

var fCollectionDates = ee.FeatureCollection(datesMosaic
    .map(function(element) {
      return ee.Feature(null, {
          prop: element
      }); 
    }));
    

print('Dates', datesMosaic)

var jet = ['black', 'blue', 'cyan', 'yellow', 'red'];

var vis = {
  min: 0, 
  max: countDates, 
  palette: jet
};

Map.add(util.makeLegend(vis)); 
Map.addLayer(smap, vis, 'smap -- first change (unfiltered)');


////////////////////////////////////////////////////////////////////////////
//             Section 3: Filtering and Post-Processing                   //
////////////////////////////////////////////////////////////////////////////


var srtm = ee.Image('USGS/SRTMGL1_003').clip(geometry); 
var slope = ee.Terrain.slope(srtm);
var gfc = ee.Image('UMD/hansen/global_forest_change_2020_v1_8').clip(geometry); 

var forest2020 = gfc.select('treecover2000')   // Select the treecover band
    .gt(0)                                     // Filter to areas that are greater than or equal to 0 (i.e. forest)
    .updateMask(gfc.select('loss')             // Select the forest loss band
        .neq(1))                               // Filter to areas that are not equal to one (i.e. forest loss did not occur in 2020)
    .selfMask();                               // Mask.


var waterJRC = ee.Image('JRC/GSW1_3/GlobalSurfaceWater').select(
    'max_extent') // select the maximum extent band of the JRC surface water dataset 



var alertsFiltered = smap
    //.updateMask(srtm.lt(1000))    // Areas with elevation < 1000 meters 
    .updateMask(slope.lt(15))      // Areas with < 15 degrees slope 
    .updateMask(forest2020.eq(1)) // Mask out areas that are forest 
    .updateMask(waterJRC.eq(0))   // Mask out areas that are not water 
    .selfMask();                  // Mask out areas where smap = 0 (i.e. no change has occurred)
    
function filterMinPatches(alerts0, minArea0, maxSize0){
  var pixelCount = alerts0.gt(0).connectedPixelCount(maxSize0); 
  var minPixelCount = ee.Image(minArea0).divide(ee.Image.pixelArea()); 
  
  return alerts0.updateMask(pixelCount.gte(minPixelCount)); 
}

var alerts_final = filterMinPatches(alertsFiltered, min_area, max_size); 

Map.addLayer(alertsFiltered, vis, 'Final RAMI Output'); 

// Delete below; 
print(geometry);


