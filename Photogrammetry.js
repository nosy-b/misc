/*
 *   @author A.D IGN
 *   @Class to manage Photogrammetry (super class). LibOri will be integrated soon
 *   
 */ 


 define (['GraphicEngine','lib/three', 'Utils','Panoramic','Draw','Navigation'], function (gfxEngine, THREE, Utils, Panoramic, Draw, Navigation) {
    
    
    var _tabRay = [],  // contains rays intersected
        WIDTH_IMG = 1920,
        HEIGHT_IMG = 1080;
    
    var Photogrammetry =  {
       
         currentRay: null,
         sightOn : null,  // 'Viseur'
         initiated: false,
         intersectionX:0,
         intersectiony:0,
         intersectionZ:0,
         
         init: function(){
             console.log('Rays initiated');
             gfxEngine.drawCam();
             this.initiated = true;
         },

         addRay: function(ray){
             _tabRay.push(ray);
         },
         getRays : function() {
            return _tabRay;
         },
         getIntersectionCamera: function(){
             
                x = 0;//(mouseX / (window.innerWidth)) * 2 - 1;
                y = 0;//- (mouseY / (window.innerHeight)) * 2 + 1;
                var panoInfos = Panoramic.getPanoInfos();
                var panoG = Panoramic.getPanoGlobale();
                var vector = new THREE.Vector3( x, y, 1 );
                var projector = new THREE.Projector();
                var ray = projector.pickingRay(vector, gfxEngine.getCamera());  
                var intersects = ray.intersectObjects(panoG.children);
                
      
                if (intersects.length > 0 ){

                    var vec3world = intersects[0].point;
                    var objectTouched = intersects[0].object;
                    //threejs version 52
                    //vec3object = new THREE.Matrix4().getInverse( objectTouched.matrixWorld ).multiplyVector3( vec3world.clone() );  
                    //threejs version 56
                    vec3object = (vec3world.clone()).applyMatrix4(new THREE.Matrix4().getInverse( objectTouched.matrixWorld ));
                    
                    var i = vec3object.x +WIDTH_IMG/2;
                    var j = HEIGHT_IMG/2- vec3object.y;
                    // Draw on bitmap
                    var ref = Panoramic.getTileTexture(objectTouched.name);
                    console.log(ref);
                    //var ref = eval("Panoramic.getTT"+objectTouched.name);
                    Draw.drawCircleAt(ref, i, j, 4);

                    // Get real position of the ray
                    var r = {
                        x1:vec3world.x, 
                        x0:0, 
                        y1:vec3world.y, 
                        y0:0, 
                        z1:vec3world.z, 
                        z0:0
                    };
                    r.x1+= parseFloat(panoInfos.easting)  - parseFloat(panoInfos.easting -  gfxEngine.getZero().x);
                    r.x0+= parseFloat(panoInfos.easting);  
                    r.y1+= parseFloat(panoInfos.altitude) - parseFloat(panoInfos.altitude - gfxEngine.getZero().y);
                    r.y0+= parseFloat(panoInfos.altitude);
                    r.z1+= parseFloat(panoInfos.northing) - parseFloat(panoInfos.northing - gfxEngine.getZero().z);
                    r.z0+= parseFloat(panoInfos.northing);

                    _tabRay.push(r);
                    var pos = [];
                    this.currentRay = r;  
                    if(_tabRay.length % 2 == 1) this.getRayIntersectionRGE(r); // Estimation on every first clic

                    // If at least 2 rays in memory we can compute the intersection to get the 3D point.
                    if(_tabRay.length % 2==0){                         
                        pos = this.PseudoIntersectionVec(_tabRay[_tabRay.length-2],_tabRay[_tabRay.length-1]);
                        var posNormalized = pos[0].toFixed(2)+" "+pos[1].toFixed(2)+" "+pos[2].toFixed(2);
                    //@TODO    gui.controlsContent.Adresse= posNormalized;
                        var vecPosSmall = new THREE.Vector3(pos[0]- gfxEngine.getZero().x ,pos[1]- gfxEngine.getZero().y ,pos[2]- gfxEngine.getZero().z);
                        Draw.drawSphereAt(vecPosSmall,0.08);
                        var newLinePosNormalized = pos[0].toFixed(2)+"\n"+pos[1].toFixed(2)+"\n"+pos[2].toFixed(2);
                        Draw.showTextAtPos3D(newLinePosNormalized,vecPosSmall.x,vecPosSmall.y,vecPosSmall.z,36);
                    /*  
                 // Add on map
                 var featureAttributes = {
                              easting: pos[0],
                              northing: pos[2], 
                              distance: pos[1] + "m", 
                              orientation: "0" + "°"
                          };
                 map.addFeaturePosition(featureAttributes,"#eeffaa");
            */      }
                }
             
         },

         // vec1 type {x1:0,x0:0,...}
         PseudoIntersectionVec: function(vec1,vec2){

              console.log('PseudoIntersectionVec');

              console.log('vec1',vec1);
              console.log('vec2',vec2);
              var vec1Relatif = new THREE.Vector3(vec1.x1 - vec1.x0, vec1.y1 - vec1.y0, vec1.z1 - vec1.z0);// UVW0
              var vec2Relatif = new THREE.Vector3(vec2.x1 - vec2.x0, vec2.y1 - vec2.y0, vec2.z1 - vec2.z0);   // UVW1

              console.log('vec1Relatif',vec1Relatif);     
              console.log('vec2Relatif',vec2Relatif); 
              var SOS1 = new THREE.Vector3(vec2.x0 - vec1.x0, vec2.y0 - vec1.y0, vec2.z0 - vec1.z0);
             // Centre de prise de vue:   XYZ0:vec1.x0y0z0 left   et   XYZ1:vec2.x0y0z0 right   ??

              var aa = vec1Relatif.clone().dot(vec1Relatif);
              var bb = -1 * vec1Relatif.clone().dot(vec2Relatif);
              var cc = vec2Relatif.clone().dot(vec2Relatif);
              var dd = vec1Relatif.clone().dot(SOS1);
              var ee = -1 * vec2Relatif.clone().dot(SOS1);
              var det = (cc * aa) - (bb * bb) ;  


              // On ne peut pas intersecter deux rayons paralleles
              if ( det <= 0 ) { return [-1,-1,-1]; }
              var lambda1 = ( (cc * dd) - (bb * ee) ) / det ;
              var lambda2 = ( (aa * ee) - (bb * dd) ) / det ;

              // coordonnees en metres dans le repere terrestre
              vec1Relatif.x = vec1.x0 + lambda1 * vec1Relatif.x;
              vec1Relatif.y = vec1.y0 + lambda1 * vec1Relatif.y;
              vec1Relatif.z = vec1.z0 + lambda1 * vec1Relatif.z;


              vec2Relatif.x = vec2.x0 + lambda2 * vec2Relatif.x;
              vec2Relatif.y = vec2.y0 + lambda2 * vec2Relatif.y;
              vec2Relatif.z = vec2.z0 + lambda2 * vec2Relatif.z;


              var xGround = ( vec1Relatif.x + vec2Relatif.x ) / 2.0 ;
              var yGround = ( vec1Relatif.y + vec2Relatif.y ) / 2.0 ;
              var zGround = ( vec1Relatif.z + vec2Relatif.z ) / 2.0 ;

              var pos3D = [xGround,yGround,zGround];

              return pos3D;

         },


          // Return the estimated position of clic using the intersection with the RGE in Lambert93 coordinates 
          // ( intersect with buildings( Bd parcellaire))
          // Ported from as3. No more heading works as we are in a real world coordinate (minus the translation)
          // Ray is an object like {x1:0,x0:0,y1:0,y0:0,z1:0,z0:0}
          getRayIntersectionRGE: function(ray){

              var distMax = 20;//GLOBAL_DIST_CLIC3D;
              console.log("currentray",this.currentRay);
              var me = this;
              var ajaxRequest;  // The variable that makes Ajax possible!

              try{
                      // Opera 8.0+, Firefox, Safari
                      ajaxRequest = new XMLHttpRequest();
              } catch (e){
                      // Internet Explorer Browsers
                      try{
                              ajaxRequest = new ActiveXObject("Msxml2.XMLHTTP");
                      } catch (e) {
                              try{
                                      ajaxRequest = new ActiveXObject("Microsoft.XMLHTTP");
                              } catch (e){
                                      // Something went wrong
                                      alert("Your browser broke!");
                                      return false;
                              }
                      }
              }


              // Create a function that will receive data sent from the server
              ajaxRequest.onreadystatechange = function(){

                      if(ajaxRequest.readyState == 4){

                              var myLinesTab = ajaxRequest.responseText.split("&");
                              var panName = myLinesTab[1].split('=')[1];
                              var x0 = myLinesTab[3].split('=')[1];
                              var y0 = myLinesTab[4].split('=')[1];
                              var z0 = myLinesTab[5].split('=')[1];
                              var xIntersection = myLinesTab[13].split('=')[1];
                              var zIntersection = myLinesTab[14].split('=')[1];
                              //console.log(xIntersection,zIntersection);

                              // Compute estimated altitude
                              var xd = Math.sqrt( (me.currentRay.x1 - me.currentRay.x0) *  (me.currentRay.x1 - me.currentRay.x0) + 
                              (me.currentRay.z1 - me.currentRay.z0) *  (me.currentRay.z1 - me.currentRay.z0) );

                              var vec0 = new THREE.Vector3(me.currentRay.x0,me.currentRay.y0,me.currentRay.z0);
                              var vec1 = new THREE.Vector3(me.currentRay.x1,me.currentRay.y1,me.currentRay.z1);

                              var hyp = vec0.distanceTo(vec1);
                              var alpha = Math.acos(xd/hyp);
                              if (me.currentRay.y1< me.currentRay.y0) alpha = - alpha;
                             // console.log("alpha",alpha);

                              var xdReal = Math.sqrt( (xIntersection - me.currentRay.x0) *  (xIntersection - me.currentRay.x0) + 
                              (zIntersection - me.currentRay.z0) *  (zIntersection - me.currentRay.z0) );

                              var ydReal = xdReal * Math.tan(alpha) + me.currentRay.y0;
                              console.log('Estimated Position using RGE', xIntersection,ydReal,zIntersection);
                              me.estimatedIntersection = [xIntersection,ydReal,zIntersection];

                              var vecPosSmall = new THREE.Vector3(xIntersection- gfxEngine.getZero().x, ydReal- gfxEngine.getZero().y, zIntersection- gfxEngine.getZero().z);
                              this.intersectionX = vecPosSmall.x;  // Global scope
                              this.intersectionY = vecPosSmall.y;
                              this.intersectionZ = vecPosSmall.z;
                              Draw.drawSphereAt(vecPosSmall,0.08);
                              var newLinePosNormalized = "Estimation: \n"+Number(xIntersection).toFixed(2)+"\n"+Number(ydReal).toFixed(2)+"\n"+Number(zIntersection).toFixed(2);
                              Draw.showTextAtPos3D(newLinePosNormalized,vecPosSmall.x,vecPosSmall.y-1,vecPosSmall.z,36);


                              // New temp: move to good position for second click
                              var newPanoName = Panoramic.jumpTo(2);
                             // params.panoname = newPanoName;
                              var newInfo = Navigation.loadPanoFromNameAndLookAtIntersection(newPanoName,{x:this.intersectionX, y:this.intersectionY, z:this.intersectionZ});
                             
                       //       IT.Utils.getInitialInfoAndLoad();

                              //cameraLookAtIntersection(x1, z1, x2, z2, headingCorrection)( vecPosSmall.x,  vecPosSmall.z, parseFloat(x0)-parseFloat(params.easting),   parseFloat(y0) - parseFloat(params.northing), 0);			

                      }	
              }

              var requete = "php/intersectionPhotogrammetry.php?pt1x=" + ray.x0 + "&pt1y=" + ray.z0 + "&pt2x=" + ray.x1 + "&pt2y=" + ray.z1;
              ajaxRequest.open("GET", requete, true);
              ajaxRequest.send(null); 
          }
          
       
        
      }
      
      
    return Photogrammetry;
 });