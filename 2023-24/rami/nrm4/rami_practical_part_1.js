            /////////////////////////////////////////////////////////////////////////////
            //                        RAMI Practical Part 1                            //
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
// https://docs.google.com/document/d/1E1CgzW1K7RyIhleCfCwxOqeI3PNHpkfT11LAOILUUFo/edit?usp=sharing

// Click the "Run" button in the upper right. This will start the program. Then scroll through the code, following 
// the instructions to interpret the output of RAMI. 

// In this script, we will work through the entire workflow of RAMI from scratch for an area of interest 
// in Southwestern Ghana. 


////////////////////////////////////////////////////////////////////////////
//    Section 1: Pre-processing, Time Period and Region of Interest       //
////////////////////////////////////////////////////////////////////////////


// Define the area of study 
var aoi = ee.Geometry.Rectangle([-2.773, 5.820, -1.8098, 6.186]);

// Center the map at the study region 
Map.centerObject(aoi, 9); 

// Create an empty image. 
var empty = ee.Image().byte(); 

// Next we will convert the area of study to an Earth Engine object so we can visualize the boundary on the map.
// This is a mining hotspot in Southwestern Ghana, the same study are we looked at in Module 2. 

var aoiOutline = empty.paint({
  featureCollection: aoi,
  color: 1, 
  width: 2
}); 

// Select the satellite basemap view 
Map.setOptions('SATELLITE'); 

// Add the area of study boundary to the map. 
Map.addLayer(aoiOutline, {
  palette: 'red'
}, 'Area of Study'); 

// Now, we will define a function that will mask SAR images acquired at an 
// incidence angle less than or equal to 31 degrees or greater than 45 degrees.

function maskAngle(image) {
  var angleMask = image.select('angle'); 
  return image.updateMask(angleMask.gte(31).and(angleMask.lte(45))); 
}

// Next, we wil define a function to get our Sentinel-1 image collection based on three input parameters. 
// These parameters include the dates we want to select, the region of interest, and the 
// orbite pass (ascending or descending) images we want 

function getCollection(dates, roi, orbitPass0) {
  var sarCollFloat = ee.ImageCollection("COPERNICUS/S1_GRD_FLOAT")
      .filterBounds(roi)
      .filterDate(dates[0], dates[1])
      .filter(ee.Filter.eq('orbitProperties_pass', orbitPass0)); 
  return sarCollFloat.map(maskAngle).select(['VV', 'VH'])
}

// Now let's define the time period we want to look at, as well as the orbit pass we want to use 

var listOfDates = ['2017-01-01', '2017-06-01']; 
var orbitPass = 'ASCENDING'; 

// Apply the function we created in line 70 to get the SAR image collection. 
var sarImageColl = getCollection(listOfDates, aoi, orbitPass); 

// Print the Image Collection to the console
print('SAR Image Collection', sarImageColl)

////////////////////////////////////////////////////////////////////////////
//                            Exercise  1                                 //
////////////////////////////////////////////////////////////////////////////

// Click the "console" tab in the upper right corner of the screen.

// This is the console of the program. Whenever we print something in the script, 
// it will get printed here. 

// The first thing that is printed in the console is the image collection we got in line 84. 
// Click on the expander arrow to the left of the text that says "ImageCollection ....", 
// then click the expander arrow to the left of the text that says "features". 
// This will expand the list of images in this image collection. You can continue 
// clicking the expander arrow next to different images to expand them and view their properties. 

///////////////////////////////////////////////////////////////////////////////

// Next, let's write a function to get dates in 'YYYY-mm-dd' format. 
function getDates(dd) {
  return ee.Date(dd).format('YYYY-MM-dd');
}

// And another function to clip our SAR Mosaic to the study area
function mosaicSAR(dates1) {
  dates1 = ee.Date(dates1); 
  var imageFilt = sarImageColl
        .filterDate(dates1, dates1.advance(1, 'day')); 
  return imageFilt.mosaic()
        .clip(aoi)
        .set({
          'system:time_start': dates1.millis(), 
          'dateYMD': dates1.format('YYYY-MM-dd')
        });
}


////////////////////////////////////////////////////////////////////////////
//                Section 2: Apply Change Detection                     //
////////////////////////////////////////////////////////////////////////////

// This next function will generate a list of dates without duplicate elements 
// (i.e. where there are images from the same dates in the collection, we will only keep one)
// This will output an image collection of mosaics

// Function to get a SAR Collection of mosaics per date. 
var datesMosaic = ee.List(sarImageColl
        .aggregate_array('system:time_start'))
      .map(getDates)
      .distinct();
      
var getMosaicList = datesMosaic.map(mosaicSAR); 
var getMosaicColl = ee.ImageCollection(getMosaicList); 

print('get Mosaic Collection', getMosaicColl);

// Map the "datesMosaic" function we just defined over the sarImageColl image collection. 
// Mapping a function just means we will apply the same function to every image within 
// an image collection. 

// Now we will apply our Omnibus Q-test Change Detection Algoirthm. We will 
// import the code to do so from two separate scripts using the "require" method.

var omb = require(
  'projects/gee-edu/book:Part A - Applications/A1 - Human Applications/A1.8 Monitoring Gold Mining Activity Using SAR/modules/omnibusTest_v1.1'
);

var util = require(
'projects/gee-edu/book:Part A - Applications/A1 - Human Applications/A1.8 Monitoring Gold Mining Activity Using SAR/modules/utilities_v1.1'
);

// Get the length of the list of dates of the time-series . 
var countDates = datesMosaic.size().getInfo(); 

// Before applying the algorithm, we need to define the input parameters 
// such as the significance and the reducer to be applied (median in this case). 

var significance = 1E-12; 
var median = true; 

// Now we will run the Omnibus Q-test Change Detection Algorithm with the parameters we have specified. 
// The result of this algorithm (run on line 169) is an Earth Engine dictionary containing multiple images. While the details of the 
// change detection algorithm are beyond the scope of this module, we are interested in the smap image,
// which contains the date or interval in which the first significant change occurred. 

var result = ee.Dictionary(omb.omnibus(getMosaicList, significance, median)); 

print('result', result)

// Get the smap image
var smap = ee.Image(result.get('smap')).byte(); 

// Now we need to make a feature collection to print the list of dates that our SAR images were taken at.
var fCollectionDates = ee.FeatureCollection(datesMosaic
    .map(function(element) {
      return ee.Feature(null, {
          prop: element
      }); 
    }));
    

print('Dates', datesMosaic)

// Set a color palette for our map
var jet = ['black', 'blue', 'cyan', 'yellow', 'red'];

// Set some visualization parameters for our 
var vis = {
  min: 0, 
  max: countDates, 
  palette: jet
};

// Add resulting images and legend to map 
Map.add(util.makeLegend(vis)); 
Map.addLayer(smap, vis, 'smap -- first change (unfiltered)'); 

// Let's focus in on a more specific region. This region is a mining hotspot.

var roi_2 = ee.Geometry.Rectangle([-2.2699, 6.0226, -2.1463, 6.1366]); 

var roi2Outline = empty.paint({
  featureCollection: roi_2, 
  color: 1, 
  width: 2
}); 

Map.addLayer(roi2Outline, {palette: 'blue'}, 'Region Of Interest 2')


////////////////////////////////////////////////////////////////////////////
//                                    Exercise 2                           //
////////////////////////////////////////////////////////////////////////////

// Using the Layers tab towards the top right of the map interface, 
// click all of the layers off except for the layers named "smap -- first change (unfiltered)" 
// and "Region of Interest 2". Recall thatthe smap layer will show us the day the first change
// occurred. The smap image will appear as all black, but if we zoom in we can see the results. 
// Zoom into the region indicated by the blue square and note what colors you see. Note that you 
// may have to zoom very far in order to see the colors. 

// Each color in the smap layer corresponds to a different date at which the algorithm detected a change. 
// Using the legend at the top of the map interface we can see that a pixel showing as red in the 
// smap image corresponds to a change detected on the 25th image in the time series. We can see that
//this correspondsto a detected change on May 25th of 2017 by clicking the expander arrow under the 
// text that says "Dates" in the console. 

// Use your best judgement based on the legend to estimate the approximate date when changes occured 
// for different pixels in the blue rectangle. For example, it seems that green pixels 
// correspond to about the 20th image on the time series. 
//////////////////////////////////////////////////////////////////////////////////


////////////////////////////////////////////////////////////////////////////
//             Section 3: Filtering and Post-Processing                   //
////////////////////////////////////////////////////////////////////////////

// In this section, we will mitigate the number of false positives generated by RAMI
// These false positivese are associated with forest loss due to river morphology change 
// and the presence of muddy water bodies. 

// Our first post-processing step is to filter out areas that have an elevation greater 
// than 1000 meters above sea level and areas that have a slope greater than 15 degrees.
// We will use the Shuttle Radar Topography Mission (SRTM) Digital Elevation Model (DEM) 
// to locate these areas and mask any positive detections that occur in this area out. 
// We filter out high elevation and high slope areas as we know that mining activity 
// in the Madre de Dios region occurs only in lowlands (and also because steep slopes 
// generate distortions in SAR images. 


// Get the SRTM Digital Elevation Model
var srtm = ee.Image('USGS/SRTMGL1_003').clip(aoi); 

// Use the Earth Engine Terrain Slope method on the srtm data to calculate the slope at every pixel. 
var slope = ee.Terrain.slope(srtm);

// Now we will filter out areas that were identified as forest or water

// Get the Hansen Global Forest change Dataset 
var gfc = ee.Image('UMD/hansen/global_forest_change_2020_v1_8').clip(aoi); 

// Filter the Hansen Dataset to areas that were forest in 2020 

var forest2020 = gfc.select('treecover2000')   // Select the treecover band
    .gt(0)                                     // Filter to areas that are greater than or equal to 0 (i.e. forest)
    .updateMask(gfc.select('loss')             // Select the forest loss band
        .neq(1))                               // Filter to areas that are not equal to one (i.e. forest loss did not occur in 2020)
    .selfMask();                               // Mask.


// Get the Joint Research Center Yearly Surface Water dataset v1.3 
var waterJRC = ee.Image('JRC/GSW1_3/GlobalSurfaceWater').select(
    'max_extent') // select the maximum extent band of the JRC surface water dataset 


// Now let's apply our filters 

var alertsFiltered = smap
    .updateMask(srtm.lt(1000))    // Areas with elevation < 1000 meters 
    .updateMask(slope.lt(15))      // Areas with < 15 degrees slope 
    .updateMask(forest2020.eq(1)) // Mask out areas that are forest 
    .updateMask(waterJRC.eq(0))   // Mask out areas that are not water 
    .selfMask();                  // Mask out areas where smap = 0 (i.e. no change has occurred)
    
// As a final postprocessing step, we will filter out small patches and isolated pixels, 
// as we know that mining in this area occurs in mining pits > 0.5 hectares in size.
    
function filterMinPatches(alerts0, minArea0, maxSize0){
  var pixelCount = alerts0.gt(0).connectedPixelCount(maxSize0); 
  var minPixelCount = ee.Image(minArea0).divide(ee.Image.pixelArea()); 
  
  return alerts0.updateMask(pixelCount.gte(minPixelCount)); 
}

// Apply the function and visualize the filtered results. 
var alerts_final = filterMinPatches(alertsFiltered, 10000, 200); 

Map.addLayer(alertsFiltered, vis, 'Final RAMI Output'); 
Map.centerObject(roi_2, 9)

//////////////////////////////////////////////////////////////////////////////
//                                    Exercise 3                            //
////////////////////////////////////////////////////////////////////////////

// Zoom into the region indicated by the blue square on the map. Using the 
// Layers tab in the top right of the map interface, switch back and forth 
// between the smap Layer and the "Final RAMI Output" Layer to compare the two. 
//////////////////////////////////////////////////////////////////////////////////

//RAMI was developed by SERVIR-Amazonia. The development team includes Lucio Villa, 
// Milagros Becerra, Sidney Novoa, Osmar Yupanqui, and John Dilger. 

// This module uses code from “Chapter A1.8: Monitoring Gold Mining Activity Using SAR”  
// from the Open-Source Book “Cloud-Based Remote Sensing with Google Earth Engine: Fundamentals 
// and Applications”. This chapter was written by Lucio Villa, Sidney Novoa, Milagros Becerra, 
// Andrea Puzzi Nicolau, Karen Dyson, Karis Tenneson, and John Dilger. 

// Review of the curriculum was conducted by Margarita Huesca Martinez and Michael Schlund, 
// Kelsey Herndon, Emil Cherrington, Diana West, Katie Walker, Lauren Carey, Jacob Abramowitz,
// Jake Ramthun, Natalia Bermudez, Stefanie Mehlich, Emily Adams, Stephanie Jimenez, Vanesa Martin, 
// Alex Goberna, Francisco Delgado, Biplov Bhandari, and Amanda Markert. 


