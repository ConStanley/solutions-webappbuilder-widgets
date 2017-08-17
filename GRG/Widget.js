define([
  'dojo',
  'dojo/_base/declare',
  'jimu/BaseWidget',
  'dojo/_base/array',
  'dojo/_base/lang',
  'dojo/dom-class',
  'dojo/dom-attr',
  'dojo/dom-construct',
  'dojo/dom-style',
  'dojo/on',
  'dojo/keys',
  'dojo/string',
  'dojo/topic',
  'dojo/_base/html',
  
  'dijit/_WidgetBase',
  'dijit/_WidgetsInTemplateMixin',
  'dijit/TooltipDialog',
  'dijit/popup',
  
  'jimu/dijit/Message',
  'jimu/dijit/LoadingIndicator',
  'jimu/utils',
  
  'esri/IdentityManager',
  'esri/arcgis/OAuthInfo',
  'esri/arcgis/Portal',
  'esri/config',
  'esri/Color',
  'esri/dijit/util/busyIndicator',
  'esri/graphic',
  'esri/geometry/geometryEngine',  
  'esri/geometry/Polyline',
  'esri/geometry/webMercatorUtils',
  'esri/layers/FeatureLayer',
  'esri/layers/GraphicsLayer',
  'esri/layers/LabelClass',
  'esri/SpatialReference',
  'esri/symbols/Font',
  'esri/symbols/SimpleMarkerSymbol',
  'esri/symbols/SimpleFillSymbol',
  'esri/symbols/TextSymbol',
  'esri/renderers/SimpleRenderer',
  'esri/tasks/query',
  'esri/request',
  
  './js/GridSettings',
  './js/CoordinateInput',
  './js/drawGRG',
  './js/PolygonFeedback',
  './js/DrawFeedBack',
  './js/EditOutputCoordinate',
  './js/geometryUtils',
  'dijit/form/NumberTextBox'
],
  function (
    dojo,
    declare,
    BaseWidget,
    array,
    lang,
    domClass,
    domAttr,
    domConstruct,
    domStyle,
    on,
    keys,
    dojoString,
    topic,
    html,
    dijitWidgetBase,    
    dijitWidgetsInTemplate,
    dijitTooltipDialog,
    dijitPopup,    
    Message,
    LoadingIndicator,
    utils,
    esriId,
    esriOAuthInfo,
    esriPortal,
    esriConfig,
    Color,
    busyIndicator,
    Graphic,
    GeometryEngine,
    Polyline,
    WebMercatorUtils,
    FeatureLayer,
    GraphicsLayer,
    LabelClass,
    SpatialReference,
    Font,
    SimpleMarkerSymbol,
    SimpleFillSymbol,
    TextSymbol,
    SimpleRenderer,
    Query,
    esriRequest,
    GridSettings,
    coordInput,
    drawGRG,
    drawFeedBackArea,
    drawFeedBackPoint,
    editOutputCoordinate,
    geometryUtils
  ) {
    return declare([BaseWidget, dijitWidgetBase, dijitWidgetsInTemplate], {
      baseClass: 'jimu-widget-GRGDrafter',
      _lastOpenPanel: "mainPage", //Flag to hold last open panel, default will be main page
      _currentOpenPanel: "mainPage", //Flag to hold last open panel, default will be main page
      _gridSettingsInstance: null, //Object to hold Plan Settings instance
      _cellShape: "default",
      _labelStartPosition: "lowerLeft",
      _cellUnits: "meters",
      _labelType: "alphaNumeric",
      _gridOrigin: "center",
      angle: 0,
      GRG: null,
      centerPoint: [],
      geodesicGrid: true,
      
      postMixInProperties: function () {
        //mixin default nls with widget nls
        this.nls.common = {};
        lang.mixin(this.nls.common, window.jimuNls.common);
      },
      
      constructor: function (args) {
          declare.safeMixin(this, args);
        },

      postCreate: function () {
        this.inherited(arguments);
        
        this.extentAreaFillSymbol = {
          type: 'esriSFS',
          style: 'esriSFSSolid',
          color: [155,155,155,155],
          outline: {
            color: [0, 0, 255, 255],
            width: 1.25,
            type: 'esriSLS',
            style: 'esriSLSSolid'
          }};
        this.GRGAreaFillSymbol = this.config.grg.gridSymbol || {
            type: 'esriSFS',
            style: 'esriSFSNull',
            color: [0,0,255,0],
            outline: {
              color: [0, 0, 255, 255],
              width: 1.25,
              type: 'esriSLS',
              style: 'esriSLSSolid'
            }};
        this.pointSymbol = {
            'color': [255, 0, 0, 255],
            'size': 8,
            'type': 'esriSMS',
            'style': 'esriSMSCircle',
            'outline': {
                'color': [255, 0, 0, 255],
                'width': 1,
                'type': 'esriSLS',
                'style': 'esriSLSSolid'
            }};
        this.cellTextSymbol = this.config.grg.textSymbol || {
            "color": {
              "r": 102,
              "g": 102,
              "b": 51,
              "a": 1
            },
            "type": "textsymbol",
            "horizontalAlignment": "center",
            "rotated": false,
            "kerning": true,
            "font": {
              "size": 11,
              "style": "normal",
              "variant": "normal",
              "weight": "normal",
              "family": "Helvetica"
            },
            "x": 0,
            "y": 0,
            "xoffset": 0,
            "yoffset": 0,
            "align": "middle"
          };
        
        // create graphics layer for grid extent and add to map
        this._graphicsLayerGRGExtent = new GraphicsLayer();
        this._extentSym = new SimpleFillSymbol(this.extentAreaFillSymbol);
        
        // create a renderer for the grg layer to override default symbology
        var gridSymbol = new SimpleFillSymbol(this.GRGAreaFillSymbol); 
        var gridRenderer = new SimpleRenderer(gridSymbol);
        
        //set up symbology for point input
        this._ptSym = new SimpleMarkerSymbol(this.pointSymbol);
        
        var featureCollection = {
            "layerDefinition": {
              "geometryType": "esriGeometryPolygon",
              "objectIdField": "ObjectID",
              "fields": [{
                "name": "ObjectID",
                "alias": "ObjectID",
                "type": "esriFieldTypeOID"
                }, {
                "name": "grid",
                "alias": "grid",
                "type": "esriFieldTypeString"
              }],
              "extent": {
            "xmin":-18746028.312877923,
            "ymin":-6027547.894280539,
            "xmax":18824299.82984192,
            "ymax":12561937.384669386,
            "spatialReference":{
              "wkid":102100
            }
          },
            }
        };
        
        this.GRGArea = new FeatureLayer(featureCollection,{
            id: "Area GRG",
            outFields: ["*"]
          });
          
        this.GRGArea.setRenderer(gridRenderer);
                  
        var json = {
          "labelExpressionInfo": {"value" : "{grid}"}
        };

        // create a text symbol to define the style of labels
        var labelClass = new LabelClass(json);
        this.textSymParams = this.cellTextSymbol || {
          font: new Font("11", Font.STYLE_NORMAL, Font.VARIANT_NORMAL, Font.WEIGHT_BOLD, "Helvetica"),
          color: new Color("#000")
        }
        labelClass.symbol = new TextSymbol(this.textSymParams);
        this.GRGArea.setLabelingInfo([labelClass]);
        
        this.map.addLayers([this.GRGArea,this._graphicsLayerGRGExtent]);

        //set up coordinate input dijit
        this.coordTool = new coordInput({nls: this.nls, appConfig: this.appConfig}, this.observerCoords);      
        this.coordTool.inputCoordinate.formatType = 'DD';
        this.coordinateFormat = new dijitTooltipDialog({
          content: new editOutputCoordinate({nls: this.nls}),
          style: 'width: 400px'
        });                
        
        // add extended toolbar for drawing GRG Area
        this.dtArea = new drawFeedBackArea(this.map,{nls: this.nls});
        
        // add extended toolbar for drawing GRG Point
        this.dtPoint = new drawFeedBackPoint(this.map,this.coordTool.inputCoordinate.util);
                              
        this._initLoading();
        
        this._handleClickEvents();
        
        this._createGridSettings();  
        
      },

      startup: function () {
        this.inherited(arguments);
        this.busyIndicator = busyIndicator.create({target: this.domNode.parentNode.parentNode.parentNode, backgroundOpacity: 0});
        this._setTheme();        
      },

      /**
      * Performs activities like resizing widget components, connect map click etc on widget open
      * @memberOf widgets/GRG/Widget
      */
      onOpen: function () {
        console.log('widget opened');
      },

      /**
      * Performs activities like disconnect map handlers, close popup etc on widget close
      * @memberOf widgets/GRG/Widget
      */
      onClose: function () {
        console.log('widget closed');
      },
      
      midPointDidChange: function (r) {
        this.centerPoint = r;
      },
      
      /*
       * angle value change
       */
      lineAngleDidChange: function (r) {
        this.angle = r;
      },           

      /**
      * This function used for loading indicator
      * @memberOf widgets/GRG/Widget
      */
      _initLoading: function () {
        this.loading = new LoadingIndicator({
          hidden: true
        });
        this.loading.placeAt(this.domNode);
        this.loading.startup();
      },

      /**
      * Handle click events for different controls
      * @memberOf widgets/GRG/Widget
      **/
      _handleClickEvents: function () {
        topic.subscribe(drawFeedBackArea.midPointDidChange, lang.hitch(this, this.midPointDidChange));          
        topic.subscribe(drawFeedBackArea.drawnLineAngleDidChange,lang.hitch(this, this.lineAngleDidChange));
        
        //handle Grid Settings from Area Panel button click
        this.own(on(this.gridSettingsAreaButton, "click", lang.hitch(this, function () {
          this._showPanel("gridSettingsPage");
        })));
        
        //handle Grid Settings from Point Panel button click
        this.own(on(this.gridSettingsPointButton, "click", lang.hitch(this, function () {
          this._showPanel("gridSettingsPage");
        })));
        
        //handle start new GRG Area button click
        this.own(on(this.newGRGAreaButton, "click", lang.hitch(this, function () {
          this._showPanel("grgAreaPage");
        })));
        
        //handle start new GRG Point button click
        this.own(on(this.newGRGPointButton, "click", lang.hitch(this, function () {
          this._showPanel("grgPointPage");
        })));
        
        //Handle click event of Grid settings back button
        this.own(on(this.gridSettingsPanelBackButton, "click", lang.hitch(this, function () {
          this._gridSettingsInstance.onClose();          
          this._showPanel(this._lastOpenPanel);
        })));
        
        //Handle click event of GRG Area back button
        this.own(on(this.grgAreaPanelBackButton, 'click', lang.hitch(this,
          this._resetOnBackToMainPage)));
          
        //Handle click event of GRG Point back button
        this.own(on(this.grgPointPanelBackButton, 'click', lang.hitch(this,
          this._resetOnBackToMainPage)));          
        
        //Handle click event of Add GRG Area draw button
        this.own(on(this.addGRGAreaBtn, 'click', lang.hitch(this, 
          this._addGRGAreaButtonClicked)));
        
        //Handle click event of Add GRG Point draw button
        this.own(on(this.addPointBtn, 'click', lang.hitch(this, 
          this._addGRGPointButtonClicked)));          
        
        //Handle completion of GRG area drawing        
        this.own(on(this.dtArea, 'draw-complete', lang.hitch(this, 
          this._drawGRGAreaComplete)));
          
        //Handle completion of GRG point drawing
        this.own(on(this.dtPoint, 'draw-complete', lang.hitch(this,
          this._drawGRGPointComplete)));              
        
        //Handle click event of delete GRG Area button        
        this.own(on(this.deleteGRGAreaBtn, 'click', lang.hitch(this, 
          this.deleteGRGAreaButtonClicked)));
          
        //Handle click event of delete GRG Area button        
        this.own(on(this.setNumberRowsColumns, 'click', lang.hitch(this, 
          this._setNumberRowsColumnsCheckBoxChanged)));
        
        //Handle click event of create GRG Area button        
        this.own(on(this.createGRGButton, 'click', lang.hitch(this, 
          this._createAreaGRG)));
        
        //Handle click event of create GRG point button        
        this.own(on(this.createPointGRGButton, 'click', lang.hitch(this, 
          this._createPointGRG)));
          
        //Handle change in coord input      
        this.own(this.coordTool.inputCoordinate.watch('outputString', lang.hitch(this,
          function (r, ov, nv) {
            if(!this.coordTool.manualInput){
              this.coordTool.set('value', nv);
            }
          }
        )));

        //Handle change in start point and update coord input
        this.own(this.dtPoint.watch('startPoint', lang.hitch(this, 
          function (r, ov, nv) {
            this.coordTool.inputCoordinate.set('coordinateEsriGeometry', nv);
            this.dtPoint.addStartGraphic(nv, this._ptSym);
          }
        )));
        
        //Handle key up events in coord input
        this.own(on(this.coordTool, 'keyup', lang.hitch(this, 
          this._coordToolKeyWasPressed)));
        
        //Handle click event on coord format button
        this.own(on(this.coordinateFormatButton, 'click', lang.hitch(this, 
          this._coordinateFormatButtonClicked)));
        
        //Handle click event on apply button of the coord format popup        
        this.own(on(this.coordinateFormat.content.applyButton, 'click', lang.hitch(this,
          this._coordinateFormatPopupApplyButtonClicked)));
        
        //Handle click event on cacncel button of the coord format popup         
        this.own(on(this.coordinateFormat.content.cancelButton, 'click', lang.hitch(this, 
          function () {
            dijitPopup.close(this.coordinateFormat);
          }
        )));
        
        //Handle click event of save GRG Area to portal button
        this.own(on(this.saveGRGButton, 'click', lang.hitch(this, function () {
          if(this.addGRGNameArea.isValid()) {
            this._initSaveToPortal(this.addGRGNameArea.value)
          } else {
            // Invalid entry
            var alertMessage = new Message({
              message: this.nls.missingLayerNameMessage
            });
          }
        })));
        
        //Handle click event of save GRG Point to portal button
        this.own(on(this.saveGRGPointButton, 'click', lang.hitch(this, function () {
          if(this.addGRGPointName.isValid()) {
            this._initSaveToPortal(this.addGRGPointName.value)
          } else {
            // Invalid entry
            var alertMessage = new Message({
              message: this.nls.missingLayerNameMessage
            });
          }
        })));
        
      },

      /**
      * This function resets everything on navigating back to main page
      * @memberOf widgets/GRG/Widget
      */
      _resetOnBackToMainPage: function () {
        //reset the tools
        this._showPanel("mainPage");
        this._reset();
      },

      _reset: function () {
          this.GRGArea.clear();
          //refresh each of the feature/graphic layers to enusre labels are removed
          for(var j = 0; j < this.map.graphicsLayerIds.length; j++) {
            this.map.getLayer(this.map.graphicsLayerIds[j]).refresh();
          }
          this.dtArea.deactivate();
          this.dtPoint.deactivate();
          this.map.enableMapNavigation();
          this.deleteGRGAreaButtonClicked();
          dojo.removeClass(this.addGRGAreaBtn, 'jimu-state-active');
          dojo.removeClass(this.addPointBtn, 'jimu-state-active');
          dojo.addClass(this.saveGRGButton, 'controlGroupHidden');
          dojo.addClass(this.saveGRGPointButton, 'controlGroupHidden');
        },      

      /**
      * Creates grid settings
      * @memberOf widgets/GRG/Widget
      **/
      _createGridSettings: function () {
        //Create GridSettings Instance
        this._gridSettingsInstance = new GridSettings({
          nls: this.nls,
          config: this.config,
          appConfig: this.appConfig
        }, domConstruct.create("div", {}, this.gridSettingsNode));        
        //add a listener for change in settings
        this.own(this._gridSettingsInstance.on("gridSettingsChanged",
          lang.hitch(this, function (updatedSettings) {
            this._cellShape = updatedSettings.cellShape;
            this._labelStartPosition = updatedSettings.labelStartPosition;
            this._cellUnits = updatedSettings.cellUnits;
            this._labelType = updatedSettings.labelType;
            this._gridOrigin = updatedSettings.gridOrigin;           
            if(this._cellShape == "default") {
              //this.cellHeight.set('disabled', false);
              html.removeClass(this.cellHeightContainer, 'controlGroupHidden');
              this.cellHeight.setValue(this.cellWidth.value);
              //this.pointCellHeight.set('disabled', false);
              html.removeClass(this.cellPointHeightContainer, 'controlGroupHidden');
              this.pointCellHeight.setValue(this.pointCellWidth.value);
            } else {
              //this.cellHeight.set('disabled', true);
              html.addClass(this.cellHeightContainer, 'controlGroupHidden');
              this.cellHeight.setValue(0);
              //this.pointCellHeight.set('disabled', true);              
              html.addClass(this.cellPointHeightContainer, 'controlGroupHidden');
              this.pointCellHeight.setValue(0);
            }            
          })));
        this._gridSettingsInstance.startup();
      },

      /**
      * Displays selected panel
      * @param {string} panel name
      * @memberOf widgets/GRG/Widget
      **/
      _showPanel: function (currentPanel) {
        var prevNode, currentNode;
        //check if previous panel exist and hide it
        if (this._currentOpenPanel) {
          prevNode = this._getNodeByName(this._currentOpenPanel);
          domClass.add(prevNode, "GRGDrafterHidden");
        }
        //get current panel to be displayed and show it
        currentNode = this._getNodeByName(currentPanel);
        domClass.remove(currentNode, "GRGDrafterHidden");
        //set the current panel and previous panel
        this._lastOpenPanel = this._currentOpenPanel;
        this._currentOpenPanel = currentPanel;
      },            

      /**
      * Get panel node from panel name
      * @param {string} panel name
      * @memberOf widgets/GRG/Widget
      **/
      _getNodeByName: function (panelName) {
        var node;
        switch (panelName) {
          case "mainPage":
            node = this.mainPageNode;
            break;
          case "grgAreaPage":
            node = this.grgAreaPageNode;
            break;
          case "grgPointPage":
            node = this.grgPointPageNode;
            break;
          case "gridSettingsPage":
            node = this.gridSettingsPageNode;
            break;
        }
        return node;
      },
      
      _addGRGAreaButtonClicked: function () {
        this.GRGArea.clear();
        
        //refresh each of the feature/graphic layers to enusre labels are removed
        for(var j = 0; j < this.map.graphicsLayerIds.length; j++) {
          this.map.getLayer(this.map.graphicsLayerIds[j]).refresh();
        }
        
        this.map.disableMapNavigation();
        this.dtArea.activate('polyline');
        domClass.toggle(this.addGRGAreaBtn, 'jimu-state-active');
        html.addClass(this.saveGRGButton, 'controlGroupHidden');        
      },
      
      _addGRGPointButtonClicked: function () {
        html.addClass(this.saveGRGPointButton, 'controlGroupHidden');
        this.dtPoint.removeStartGraphic();
        this.GRGArea.clear();
        //refresh each of the feature/graphic layers to enusre labels are removed
        for(var j = 0; j < this.map.graphicsLayerIds.length; j++) {
          this.map.getLayer(this.map.graphicsLayerIds[j]).refresh();
        }
        this.coordTool.manualInput = false;
        
        this.dtPoint._setTooltipMessage(0);
        
        this.map.disableMapNavigation();          
        this.dtPoint.activate('point');
        var tooltip = this.dtPoint._tooltip;
        if (tooltip) {
          tooltip.innerHTML = 'Click to add GRG center point';
        }
        domClass.toggle(this.addPointBtn, 'jimu-state-active');
      },
      
      _drawGRGAreaComplete: function (evt) {          
        var graphic = new Graphic(evt.geometry, this._extentSym);
        this._graphicsLayerGRGExtent.add(graphic);
        this.map.enableMapNavigation();
        this.dtArea.deactivate();
        
        //if the input id geographics project the geometry to WMAS
        if (evt.geometry.spatialReference.wkid == 4326) {
          // if the geographic point can be projected the map spatial reference do so
          evt.geometry = WebMercatorUtils.geographicToWebMercator(evt.geometry);
        }
       
        //calculate the geodesic width and height of the required grid cells
        var calculatedCellWidth = ((GeometryEngine.geodesicLength(new Polyline({
            paths: [[[evt.geometry.getPoint(0,0).x, evt.geometry.getPoint(0,0).y], [evt.geometry.getPoint(0,1).x, evt.geometry.getPoint(0,1).y]]],
            spatialReference: evt.geometry.spatialReference
          }), this._cellUnits))/this.cellHorizontal.value);
          
        var calculatedCellHeight = ((GeometryEngine.geodesicLength(new Polyline({
            paths: [[[evt.geometry.getPoint(0,0).x, evt.geometry.getPoint(0,0).y], [evt.geometry.getPoint(0,3).x, evt.geometry.getPoint(0,3).y]]],
            spatialReference: evt.geometry.spatialReference
          }), this._cellUnits))/this.cellVertical.value);
          
        //convert the width and height into meters
        var cellWidthMeters = this.coordTool.inputCoordinate.util.convertToMeters(calculatedCellWidth, this._cellUnits);
        var cellHeightMeters = this.coordTool.inputCoordinate.util.convertToMeters(calculatedCellHeight, this._cellUnits);

        /**
        * if the width or height of a grid cell is over 20000m we need to use a planar grid
        * so recalculate the width and height using a planar measurement
        **/
        if((cellWidthMeters < 20000) && ((cellHeightMeters < 20000 && this._cellShape != "hexagon") || this._cellShape == "hexagon")) {
          this.geodesicGrid = true;
          this.cellWidth.setValue(calculatedCellWidth);
          this._cellShape == "default"?this.cellHeight.setValue(calculatedCellHeight):this.cellHeight.setValue(0);
        } else {
          this.geodesicGrid = false;
          this.cellWidth.setValue(((GeometryEngine.distance(evt.geometry.getPoint(0,0), evt.geometry.getPoint(0,1), this._cellUnits))/this.cellHorizontal.value)); 
          this._cellShape == "default"?this.cellHeight.setValue(((GeometryEngine.distance(evt.geometry.getPoint(0,0), evt.geometry.getPoint(0,3), this._cellUnits))/this.cellVertical.value)):this.cellHeight.setValue(0);
        }
        
        domClass.toggle(this.addGRGArea, "controlGroupHidden");
        domClass.toggle(this.deleteGRGArea, "controlGroupHidden");
      },
      
      _drawGRGPointComplete: function (results) {          
        domClass.remove(this.addPointBtn, 'jimu-state-active');
        this.dtPoint.deactivate();
        this.map.enableMapNavigation();
      },
      
      /*
       * catch key press in start point
       */
      _coordToolKeyWasPressed: function (evt) {
        this.coordTool.manualInput = true;
        if (evt.keyCode === keys.ENTER) {
          this.coordTool.inputCoordinate.getInputType().then(lang.hitch(this, 
            function (r) {
              if(r.inputType == "UNKNOWN"){
                var alertMessage = new Message({
                  message: this.nls.coordInputError
                });
              } else {
                this._reset();
                topic.publish(
                  'grg-center-point-input',
                  this.coordTool.inputCoordinate.coordinateEsriGeometry
                );
                this._setCoordLabel(r.inputType);
                var fs = this.coordinateFormat.content.formats[r.inputType];
                this.coordTool.inputCoordinate.set('formatString', fs.defaultFormat);
                this.coordTool.inputCoordinate.set('formatType', r.inputType);
                this.dtPoint.addStartGraphic(r.coordinateEsriGeometry, this._ptSym);
              }
            }
          ));
        }
      },
      
      /*
       *
       */
      _setCoordLabel: function (toType) {
        this.coordInputLabel.innerHTML = dojoString.substitute(
          'GRG Center Point (${crdType})', {
              crdType: toType
          });
      },
      
      /*
       *
       */
      _coordinateFormatButtonClicked: function () {
        this.coordinateFormat.content.set('ct', this.coordTool.inputCoordinate.formatType);
        dijitPopup.open({
            popup: this.coordinateFormat,
            around: this.coordinateFormatButton
        });
      },
      
      /*
       *
       */
      _coordinateFormatPopupApplyButtonClicked: function () {
        var fs = this.coordinateFormat.content.formats[this.coordinateFormat.content.ct];
        var cfs = fs.defaultFormat;
        var fv = this.coordinateFormat.content.frmtSelect.get('value');
        if (fs.useCustom) {
            cfs = fs.customFormat;
        }
        this.coordTool.inputCoordinate.set(
          'formatPrefix',
          this.coordinateFormat.content.addSignChkBox.checked
        );
        this.coordTool.inputCoordinate.set('formatString', cfs);
        this.coordTool.inputCoordinate.set('formatType', fv);
        this._setCoordLabel(fv);
        dijitPopup.close(this.coordinateFormat);        
      }, 
      
      
      deleteGRGAreaButtonClicked: function () {
        this._graphicsLayerGRGExtent.clear();
        
        //reset the angle
        this.angle = 0;
        
        html.removeClass(this.addGRGAreaBtn, 'jimu-state-active');          
        html.removeClass(this.addGRGArea, 'controlGroupHidden');
        html.addClass(this.addGRGArea, 'controlGroup');
        html.removeClass(this.deleteGRGArea, 'controlGroup');
        html.addClass(this.deleteGRGArea, 'controlGroupHidden');          
      },
      
      _setNumberRowsColumnsCheckBoxChanged: function () {
        if(this.setNumberRowsColumns.checked) {
          html.removeClass(this.numberOfCellsContainer, 'controlGroupHidden');
          this.cellWidth.set('disabled', true);
          this.cellHeight.set('disabled', true);
        } else {
          html.addClass(this.numberOfCellsContainer, 'controlGroupHidden');
          this.cellWidth.set('disabled', false);
          this.cellHeight.set('disabled', false);
          this.cellHorizontal.set('value', 10);
          this.cellVertical.set('value', 10);
        }
      },
      
      _createAreaGRG: function () {                 
        //check form inputs for validity
        if (this._graphicsLayerGRGExtent.graphics[0] && this.cellWidth.isValid() && this.cellHeight.isValid()) {
          var geom = this._graphicsLayerGRGExtent.graphics[0].geometry;

          //if the input is geographics project the geometry to WMAS
          if (geom.spatialReference.wkid == 4326) {
            // if the geographic point can be projected the map spatial reference do so
            geom = WebMercatorUtils.geographicToWebMercator(geom);
          }
          
          var GRGAreaWidth, GRGAreaHeight;
          //work out width and height of AOI, method depends on if the grid is to be geodesic
          if(this.geodesicGrid) {
            GRGAreaWidth = GeometryEngine.geodesicLength(new Polyline({
              paths: [[[geom.getPoint(0,0).x, geom.getPoint(0,0).y], [geom.getPoint(0,1).x, geom.getPoint(0,1).y]]],
              spatialReference: geom.spatialReference
            }), 'meters');          
            GRGAreaHeight = GeometryEngine.geodesicLength(new Polyline({
              paths: [[[geom.getPoint(0,0).x, geom.getPoint(0,0).y], [geom.getPoint(0,3).x, geom.getPoint(0,3).y]]],
              spatialReference: geom.spatialReference
            }), 'meters');            
          } else {
            GRGAreaWidth = GeometryEngine.distance(geom.getPoint(0,0), geom.getPoint(0,1), 'meters'); 
            GRGAreaHeight = GeometryEngine.distance(geom.getPoint(0,0), geom.getPoint(0,3), 'meters');
          }
          
          var cellWidth = this.coordTool.inputCoordinate.util.convertToMeters(this.cellWidth.value, this._cellUnits);
          var cellHeight = this.coordTool.inputCoordinate.util.convertToMeters(this.cellHeight.value,this._cellUnits);
          
          //work out how many cells are needed horizontally & Vertically to cover the whole canvas area
          var numCellsHorizontal = Math.round(GRGAreaWidth/cellWidth);
          
          var numCellsVertical;
          this._cellShape == "default"?numCellsVertical = Math.round(GRGAreaHeight/cellHeight):numCellsVertical = Math.round(GRGAreaHeight/(cellWidth)/Math.cos(30* Math.PI/180)) + 1;
          
          if(drawGRG.checkGridSize(numCellsHorizontal,numCellsVertical))
          {
            var features = drawGRG.createGRG(
              numCellsHorizontal,
              numCellsVertical,
              this.centerPoint,
              cellWidth,
              cellHeight,
              this.angle,
              this._labelStartPosition,
              this._labelType,
              this._cellShape,
              'center',
              this.geodesicGrid,
              this.map,              
              esriConfig.defaults.geometryService); 
            //apply the edits to the feature layer
            this.GRGArea.applyEdits(features, null, null);
            this.deleteGRGAreaButtonClicked();              
            html.removeClass(this.saveGRGButton, 'controlGroupHidden');
          }
        }
      },
      
      /*
       *
       */
      _createPointGRG: function () {
        //check form inouts for validity
        if (this.dtPoint.startGraphic && this.pointCellWidth.isValid() && this.pointCellHeight.isValid() && this.gridAnglePoint.isValid()) {
          
          //get center point of AOI
          var centerPoint = WebMercatorUtils.geographicToWebMercator(this.coordTool.inputCoordinate.coordinateEsriGeometry);
          
          var cellWidth = this.coordTool.inputCoordinate.util.convertToMeters(this.pointCellWidth.value,this._cellUnits);
          var cellHeight = this.coordTool.inputCoordinate.util.convertToMeters(this.pointCellHeight.value,this._cellUnits);          

          // if the width or height of a grid cell is over 20000m we need to use a planar grid
          if((cellWidth < 20000) && ((cellHeight < 20000 && this._cellShape != "hexagon") || this._cellShape == "hexagon")) {
            this.geodesicGrid = true;
          } else {
            this.geodesicGrid = false;
          }
          
          if(drawGRG.checkGridSize(this.pointCellHorizontal.value,this.pointCellVertical.value))
          {
            var features = drawGRG.createGRG(
              this.pointCellHorizontal.value,
              this.pointCellVertical.value,
              centerPoint,
              cellWidth,
              cellHeight,
              this.gridAnglePoint.value,
              this._labelStartPosition,
              this._labelType,
              this._cellShape,
              this._gridOrigin,
              this.geodesicGrid,
              this.map,
              esriConfig.defaults.geometryService); 
            //apply the edits to the feature layer
            this.GRGArea.applyEdits(features, null, null);
            html.removeClass(this.saveGRGPointButton, 'controlGroupHidden');
            this.dtPoint.removeStartGraphic();              
          }
          
        } else {
          // Invalid entry
          var alertMessage = new Message({
            message: this.nls.missingParametersMessage
          });          
        }
      },

      //source:
      //https://stackoverflow.com/questions/9979415/dynamically-load-and-unload-stylesheets
      _removeStyleFile: function (filename, filetype) {
        //determine element type to create nodelist from
        var targetelement = null;
        if (filetype === "js") {
          targetelement = "script";
        } else if (filetype === "css") {
          targetelement = "link";
        } else {
          targetelement = "none";
        }
        //determine corresponding attribute to test for
        var targetattr = null;
        if (filetype === "js") {
          targetattr = "src";
        } else if (filetype === "css") {
          targetattr = "href";
        } else {
          targetattr = "none";
        }
        var allsuspects = document.getElementsByTagName(targetelement);
        //search backwards within nodelist for matching elements to remove
        for (var i = allsuspects.length; i >= 0; i--) {
          if (allsuspects[i] &&
            allsuspects[i].getAttribute(targetattr) !== null &&
            allsuspects[i].getAttribute(targetattr).indexOf(filename) !== -1) {
            //remove element by calling parentNode.removeChild()
            allsuspects[i].parentNode.removeChild(allsuspects[i]);
          }
        }
      },

      _setTheme: function () {
        //Check if Dart Theme
        if (this.appConfig.theme.name === "DartTheme") {
          //Load appropriate CSS for dart theme
          utils.loadStyleLink('darkOverrideCSS', this.folderUrl + "css/dartTheme.css", null);
          domClass.add(this.coordinateFormat.domNode, 'dartThemeClaroDijitTooltipContainerOverride');
        } else {
          this._removeStyleFile('darkTheme.css', 'css');
        }
        
        //Check if dashboard Theme
        if (this.appConfig.theme.name === "DashboardTheme") {
          //Load appropriate CSS for dart theme
          utils.loadStyleLink('dashboardOverrideCSS', this.folderUrl + "css/dashboardTheme.css", null);
        } else {
          this._removeStyleFile('dashboardTheme.css', 'css');
        }
      },
      
      _initSaveToPortal: function(layerName) {          
          
          esriId.registerOAuthInfos();
          
          var featureServiceName = layerName;
          
          esriId.getCredential(this.appConfig.portalUrl + "/sharing", { oAuthPopupConfirmation: false }).then(lang.hitch(this, function() {
            //sign in
            new esriPortal.Portal(this.appConfig.portalUrl).signIn().then(lang.hitch(this, function(portalUser) {
             //Get the token
              var token = portalUser.credential.token;
              var orgId = portalUser.orgId;
              var userName = portalUser.username;
              
              var checkServiceNameUrl = this.appConfig.portalUrl + "sharing/rest/portals/" + orgId + "/isServiceNameAvailable";
              var createServiceUrl = this.appConfig.portalUrl + "sharing/content/users/" + userName + "/createService"; 

              drawGRG.isNameAvailable(checkServiceNameUrl, token, featureServiceName).then(lang.hitch(this, function(response0) {
                if (response0.available) {
                  //set the widget to busy
                  this.busyIndicator.show();
                  //create the service
                  drawGRG.createFeatureService(createServiceUrl, token, drawGRG.getFeatureServiceParams(featureServiceName, this.map)).then(lang.hitch(this, function(response1) {
                    if (response1.success) {
                      var addToDefinitionUrl = response1.serviceurl.replace(new RegExp('rest', 'g'), "rest/admin") + "/addToDefinition";
                      drawGRG.addDefinitionToService(addToDefinitionUrl, token, drawGRG.getLayerParams(featureServiceName, this.map, this.cellTextSymbol, this.GRGAreaFillSymbol)).then(lang.hitch(this, function(response2) {
                        if (response2.success) {
                          //Push features to new layer
                          var newFeatureLayer = new FeatureLayer(response1.serviceurl + "/0?token=" + token, {
                            mode: FeatureLayer.MODE_SNAPSHOT,
                            outFields: ["*"]                                  
                           });
                          this.map.addLayer(newFeatureLayer);

                          var newGraphics = [];
                          array.forEach(this.GRGArea.graphics, function (g) {
                            newGraphics.push(new Graphic(g.geometry, null, {grid: g.attributes["grid"]}));
                          }, this);

                          newFeatureLayer.applyEdits(newGraphics, null, null).then(lang.hitch(this, function(){
                            this._reset();                                
                          })).otherwise(lang.hitch(this,function(){
                            this._reset();
                          })); 
                          this.busyIndicator.hide();
                        }
                      }), function(err2) {
                        this.busyIndicator.hide();
                        new Message({
                          message: "Add to definition: " + err2.message
                        });                              
                      });
                    } else {
                      this.busyIndicator.hide();
                      new Message({
                        message: "Unable to create " + featureServiceName
                      });
                    }
                  }), function(err1) {
                    this.busyIndicator.hide();
                    new Message({
                      message: "Create Service: " + err1.message
                    });
                  });
                } else {
                    this.busyIndicator.hide();
                    new Message({                 
                      message: "You already have a feature service named " + featureServiceName + ". Please choose another name."
                  });                    
                }
              }), function(err0) {
                this.busyIndicator.hide();
                new Message({
                  message: "Check Service: " + err0.message
                });
              });
            }))
          }));          
      }     
    });
  });