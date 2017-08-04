///////////////////////////////////////////////////////////////////////////
// Copyright © 2016 Esri. All Rights Reserved.
//
// Licensed under the Apache License Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
///////////////////////////////////////////////////////////////////////////

define([
  'dojo/_base/declare',
  'dijit/_WidgetsInTemplateMixin',
  'jimu/BaseWidgetSetting',
  'jimu/dijit/SimpleTable',
  'jimu/dijit/TabContainer3',
  'jimu/LayerInfos/LayerInfos',
  'jimu/utils',
  'jimu/dijit/Message',
  'jimu/dijit/SymbolPicker',
  'dojo/_base/lang',
  'dojo/_base/html',
  'dojo/on',
  'dojo/when',
  'dojo/query',
  'dojo/_base/array',
  '../locatorUtils',
  './EditFields',
  './LocatorSourceSetting',
  'dijit/form/NumberSpinner',
  'dijit/form/Select',
  'dijit/form/ValidationTextBox',
  'jimu/dijit/CheckBox',
  'jimu/dijit/LayerChooserFromMapWithDropbox',
  './EditablePointFeatureLayerChooserFromMap',
  'dojo/dom-construct',
  'dojo/dom-style',
  'esri/symbols/jsonUtils'
],
  function (
    declare,
    _WidgetsInTemplateMixin,
    BaseWidgetSetting,
    SimpleTable,
    TabContainer3,
    LayerInfos,
    utils,
    Message,
    SymbolPicker,
    lang,
    html,
    on,
    when,
    query,
    array,
    _utils,
    EditFields,
    LocatorSourceSetting,
    NumberSpinner,
    Select,
    ValidationTextBox,
    CheckBox,
    LayerChooserFromMapSelect,
    EditablePointFeatureLayerChooserFromMap,
    domConstruct,
    domStyle,
    jsonUtils) {
    return declare([BaseWidgetSetting, _WidgetsInTemplateMixin], {
      baseClass: 'jimu-widget-setting-critical-facilities',

      //TODO persist values and reload correctly
      //TODO disable OK when no layer is selected
      //TODO add logic for needing at least one of the checkboxes checked...ok should disable
      //TODO figure out what's up with the css for all SimpleTable instances with the rows. I handled in some way for IS but it was not correct
      //TODO update validation logic for the validation controls for max and search dist
      //TODO disable ok if any validators are invalid
      //TODO do like some of the other controls that use this layer chooser and have it expanded on startup when no value has been specified by the user
      //TODO get fields from the layer selected in the layer chooser
      //TODO need to get the fields lists for single or multi back within the LocatorSourceSetting since they need to be stored for each locator

      //Questions
      //TODO should we support an option for configure user to mark certain fields as required or optional?
      
      _operLayerInfos: null,
      _layersTable: null,
      _arrayOfFields: null,
      _layerInfos: [],

      startup: function () {
        this.inherited(arguments);

        this.nls = lang.mixin(this.nls, window.jimuNls.common);

        if (!(this.config && this.config.sources)) {
          this.config.sources = [];
        }

        LayerInfos.getInstance(this.map, this.map.itemInfo)
          .then(lang.hitch(this, function (operLayerInfos) {
            this._operLayerInfos = operLayerInfos;

            this._initUI();
            _utils.setMap(this.map);
            _utils.setLayerInfosObj(this._operLayerInfos);
            _utils.setAppConfig(this.appConfig);
            _utils.setDefaultXYFields(this.config.defaultXYFields);
            when(_utils.getConfigInfo(this.config)).then(lang.hitch(this, function (config) {
              if (!this.domNode) {
                return;
              }
              this.setConfig(config);
            }));
          }));
      },

      _setDefaultXYFields: function () {
        this.config.defaultXYFields = [{
          "name": this.nls.xyFieldsLabelX,
          "alias": this.nls.xyFieldsLabelX,
          "visible": true,
          "isRecognizedValues": [this.nls.xyFieldsLabelX, this.nls.longitude, this.nls.easting],
          "type": "STRING"
        }, {
          "name": this.nls.xyFieldsLabelY,
          "alias": this.nls.xyFieldsLabelY,
          "visible": true,
          "isRecognizedValues": [this.nls.xyFieldsLabelY, this.nls.latitude, this.nls.northing],
          "type": "STRING"
        }];
      },

      _initMaxRecords: function () {
        var ls = this.config.layerSettings;
        this.maxRecords.setValue((ls && ls.maxRecords && ls.maxRecords !== NaN) ? ls.maxRecords : undefined);
      },

      _initSearchRadius: function () {
        var ls = this.config.layerSettings;

        //set distance
        this.searchDistance.setValue((ls && ls.distance && ls.distance !== NaN) ? ls.distance : 2);

        //set units
        var units = window.jimuNls.units;      
        var validUnits = ['miles', 'kilometers', 'feet', 'meters', 'yards'];
        var defaultUnit = (ls && ls.unit && validUnits.indexOf(ls.unit) > -1) ? ls.unit : 'feet';
        var unitOptions = [];
        array.forEach(validUnits, function (k) {
          unitOptions.push({ label: units[k], value: k, selected: k === defaultUnit ? true : false});
        });
        this.searchUnit.addOption(unitOptions);
      },

      _initSymbolPicker: function () {
        
        if (this.config.layerSettings && this.config.layerSettings.symbol) {
          //TODO any way to check this is a valid symbol?
          this.symbolPicker.showBySymbol(jsonUtils.fromJson(this.config.layerSettings.symbol));
        } else {
          this.symbolPicker.showByType('marker');
        }
      },

      _initUI: function () {
        this._initTabs();
        //this._initLayersTable();
        this._createLayerChooserSelect(true);
        this._initLocationOptions();
      },

      _initTabs: function () {
        this._tabsContainer = new TabContainer3({
          tabs: [{
            title: this.nls.layerTab.layerTabLabel,
            content: this.layerTabNode
          }, {
            title: this.nls.geocodeTab.geocodeTabLabel,
            content: this.geocodeTabNode
          }]
        }, this.tabContainer);
        this.own(on(this._tabsContainer, "tabChanged", lang.hitch(this, function () {
          this._tabsContainer.containerNode.scrollTop = 0;
        })));
        this._tabsContainer.startup();
      },

      _createLayerChooserSelect: function (bindEvent) {
        if (this.layerChooserSelect) {
          this.layerChooserSelect.destroy();
        }
        this.layerChooserSelect = null;

        var layerChooserFromMap = new EditablePointFeatureLayerChooserFromMap({
          multiple: false,
          showLayerFromFeatureSet: false,
          showTable: false,
          onlyShowVisible: false,
          createMapResponse: this.map.webMapResponse
        });
        layerChooserFromMap.startup();

        this.layerChooserSelect = new LayerChooserFromMapSelect({
          layerChooser: layerChooserFromMap
        });
        this.layerChooserSelect.placeAt(this.layerTd);
        this.layerChooserSelect.startup();
        if (bindEvent) {
          this.own(on(this.layerChooserSelect, 'selection-change', lang.hitch(this, function (l) {
            console.log(l);
            //TODO make sure this is the expected way to get the layer when you have morethan one in the map
            this.layer = l[0];
          })));
        }
      },

      _onLayerChanged: function () {
        var item = this.layerChooserSelect.getSelectedItem();
        if (!item) {
          return;
        }
        var layerInfo = item.layerInfo;
        var layer = layerInfo.layerObject;
      },

      _initLocationOptions: function () {
        this.sourceList = new SimpleTable({
          autoHeight: false,
          selectable: true,
          fields: [{
            name: "name",
            title: this.nls.name,
            width: "auto",
            type: "text",
            editable: false
          }, {
            name: "actions",
            title: "",
            width: "80px",
            type: "actions",
            actions: ["up", "down", "delete"]
          }]
        }, this.sourceList);
        html.setStyle(this.sourceList.domNode, 'height', '100%');
        this.sourceList.startup();
        this.own(on(this.sourceList, 'row-select', lang.hitch(this, this._onSourceItemSelected)));
        this.own(on(this.sourceList, 'row-delete', lang.hitch(this, this._onSourceItemRemoved)));

        this.enableXYField = this._initCheckBox(this.enableXYField, this.nls.enableXYField, this.editXYFields);
        this.own(on(this.editXYFields, 'click', lang.hitch(this, this._editFields)));

        this.enableSingleField = this._initCheckBox2(this.enableSingleField, this.nls.enableSingleField, this.editSingleFields);
        this.enableMultiField = this._initCheckBox2(this.enableMultiField, this.nls.enableMultiField, this.editMultiFields);

        this.own(on(this.editSingleFields, 'click', lang.hitch(this, this._editFields, 'single')));
        this.own(on(this.editMultiFields, 'click', lang.hitch(this, this._editFields, 'multi')));

        
      },

      _initCheckBox2: function (domNode, nlsValue, editNode) {
        domNode = new CheckBox({
          checked: false,
          label: nlsValue
        }, domNode);
        this._toggleNode(editNode, false);
        this.own(on(domNode, 'change', lang.hitch(this, function () {
          var enabled = domNode.getValue();
          switch (domNode.label) {
            case this.nls.enableSingleField:
              this.singleEnabled = enabled;
              break;
            case this.nls.enableMultiField:
              this.multiEnabled = enabled;
              break;
          }
          this._toggleNode(editNode, enabled);
          this._toggleContainerNode((this.singleEnabled || this.multiEnabled) ? true : false);
        })));
        return domNode;
      },

      _toggleContainerNode: function (enable) {
        html.removeClass(this.locatorOptions, enable ? 'display-none' : 'display-block');
        html.addClass(this.locatorOptions, enable ? 'display-block' : 'display-none');
      },

      _getLayerDefinitionForFilterDijit: function (layer) {
        var layerDefinition = null;

        if (layer.declaredClass === 'esri.layers.FeatureLayer') {
          layerDefinition = jimuUtils.getFeatureLayerDefinition(layer);
        }

        if (!layerDefinition) {
          layerDefinition = {
            currentVersion: layer.currentVersion,
            fields: lang.clone(layer.fields)
          };
        }

        return layerDefinition;
      },

      _initStoreResultsCheckBox: function (domNode, nlsValue, editNode) {
        domNode = new CheckBox({
          checked: false,
          label: nlsValue
        }, domNode);
        this._toggleNode(editNode, false);
        this.own(on(domNode, 'change', lang.hitch(this, function () {
          var enabled = domNode.getValue();
          this.xyEnabled = enabled;
          this._toggleNode(editNode, enabled);
        })));
        return domNode;
      },

      //addded for xy fields may simplify
      _initCheckBox: function (domNode, nlsValue, editNode) {
        domNode = new CheckBox({
          checked: false,
          label: nlsValue
        }, domNode);
        this._toggleNode(editNode, false);
        this.own(on(domNode, 'change', lang.hitch(this, function () {
          var enabled = domNode.getValue();
          this.xyEnabled = enabled;
          this._toggleNode(editNode, enabled);
        })));
        return domNode;
      },

      //addded for xy fields may simplify
      _toggleNode: function (domNode, enable) {
        if (domNode) {
          html.removeClass(domNode, enable ? 'edit-fields-disabled' : 'edit-fields');
          html.addClass(domNode, enable ? 'edit-fields' : 'edit-fields-disabled');
        }
      },

      //_addLayerRows: function () {
      //  if (this._editablePointLayerInfos) {
      //    array.forEach(this._editablePointLayerInfos, lang.hitch(this, function (layerInfo) {
      //      var addRowResult = this._layersTable.addRow({
      //        txtLayerLabel: layerInfo.featureLayer.title,
      //        url: layerInfo.url
      //      });
      //      if (addRowResult && addRowResult.success) {
      //        this._setRowConfig(addRowResult.tr, layerInfo);
      //      } else {
      //        console.error("add row failed ", addRowResult);
      //      }
      //    }));
      //  } else {
      //    this._disableOk();
      //    new Message({
      //      message: this.nls.needsEditablePointLayers
      //    });
      //  }
      //},

      _onEditFieldsClick: function (tr) {
        var rowData = this._layersTable.getRowData(tr);
        if (rowData && rowData.rdoLayer) {
          var editFields = new EditFields({
            nls: this.nls,
            _layerInfo: this._getRowConfig(tr),
            type: 'fieldInfos'
          });
          editFields.popupEditPage();
        } else {
          new Message({
            message: this.nls.noSelectField
          });
        }
      },

      setConfig: function (config) {
        this.config = config;
        var sources = config.sources;
        array.forEach(sources, lang.hitch(this, function (source, index) {
          var addResult = this.sourceList.addRow({
            name: source.name || ""
          });
          if (addResult && addResult.success) {
            this._setRowConfig(addResult.tr, source);
            if (index === 0) {
              var firstTr = addResult.tr;
              setTimeout(lang.hitch(this, function () {
                this.sourceList.selectRow(addResult.tr);
                firstTr = null;
              }), 100);
            }
          } else {
            console.error("add row failed ", addResult);
          }
        }));

        //setTimeout(lang.hitch(this, function () {
        this.layerChooserSelect.showLayerChooser();
        //}), 50);

        //var trs = this._layersTable.getRows();
        //var tr;
        //if (this.config.layerInfos && this.config.layerInfos.hasOwnProperty(0)) {
        //  var configLayerInfo = this.config.layerInfos[0];       
        //  for (var i = 0; i < trs.length; i++) {
        //    tr = trs[i];
        //    var rc = this._getRowConfig(tr);
        //    if (rc.featureLayer.id === configLayerInfo.featureLayer.id) {
        //      break;
        //    }
        //  }
        //} else {
        //  tr = trs[0];
        //}
        //if (tr) {
        //  var radio = query('input', tr.firstChild)[0];
        //  radio.checked = true;
        //}

        //Layer Settings
        this._initSymbolPicker();
        this._initMaxRecords();
        this._initSearchRadius();

        //TODO consolidate after I remind myself if thsi is already handled elsewhere
        if (typeof (this.config.singleEnabled) !== 'undefined' && this.config.singleEnabled !== NaN) {
          this.singleEnabled = this.config.singleEnabled;
        } else {
          this.singleEnabled = false;
        }

        if (typeof (this.config.multiEnabled) !== 'undefined' && this.config.multiEnabled !== NaN) {
          this.multiEnabled = this.config.multiEnabled;
        } else {
          this.multiEnabled = false;
        }

        this._toggleContainerNode((this.singleEnabled || this.multiEnabled) ? true : false);


        //X/Y settings
        if (!this.config.defaultXYFields) {
          this._setDefaultXYFields();
        }

        if (typeof (this.config.xyEnabled) !== 'undefined') {
          this.xyEnabled = this.config.xyEnabled;
          this.enableXYField.setValue(this.config.xyEnabled);
        }

        this._setXYFields(this.defaultXYFields, this.config);
      },

      //_getEditablePointLayerInfos: function () {
      //  var editableLayerInfos = [];
      //  for (var i = this.map.graphicsLayerIds.length - 1; i >= 0; i--) {
      //    var layerObject = this.map.getLayer(this.map.graphicsLayerIds[i]);
      //    if (layerObject.type === "Feature Layer" &&
      //        layerObject.url &&
      //        layerObject.isEditable &&
      //        layerObject.isEditable() &&
      //        layerObject.geometryType === "esriGeometryPoint") {
      //      var layerInfo = this._getLayerInfoFromConfiguration(layerObject);
      //      if (!layerInfo) {
      //        layerInfo = this._getDefaultLayerInfo(layerObject);
      //      }
      //      editableLayerInfos.push(layerInfo);
      //    }
      //  }
      //  return editableLayerInfos;
      //},

      _getLayerInfoFromConfiguration: function (layerObject) {
        var layerInfo = null;
        var layerInfos = this.config.layerInfos;
        if (layerInfos && layerInfos.length > 0) {
          for (var i = 0; i < layerInfos.length; i++) {
            if (layerInfos[i].featureLayer &&
               layerInfos[i].featureLayer.id === layerObject.id) {
              layerInfo = layerInfos[i];
              break;
            }
          }
          if (layerInfo) {
            layerInfo.fieldInfos = this._getFieldInfos(layerObject, layerInfo);
          }
        }
        return layerInfo;
      },

      _getDefaultLayerInfo: function (layerObject) {
        var layerInfo = {
          'featureLayer': {
            'id': layerObject.id,
            'fields': layerObject.fields,
            'title': layerObject.name,
            'url': layerObject.url
          },
          'fieldInfos': this._getFieldInfos(layerObject)
        };
        return layerInfo;
      },

      _getDefaultFieldInfos: function (layerObject) {
        var fieldInfos = [];
        for (var i = 0; i < layerObject.fields.length; i++) {
          if (layerObject.fields[i].editable &&
            layerObject.fields[i].name !== layerObject.globalIdField &&
            layerObject.fields[i].name !== layerObject.objectIdField) {
            fieldInfos.push({
              fieldName: layerObject.fields[i].name,
              label: layerObject.fields[i].alias || layerObject.fields[i].name,
              isEditable: layerObject.fields[i].editable,
              visible: true,
              type: layerObject.fields[i].type
            });
          }
        }
        return fieldInfos;
      },

      _getWebmapFieldInfos: function (layerObject) {
        var fieldInfos = [];
        var wFieldInfos = this._getFieldInfosFromWebmap(layerObject.id, this._operLayerInfos);
        if (wFieldInfos) {
          array.forEach(wFieldInfos, function (fi) {
            if ((fi.isEditableOnLayer !== undefined && fi.isEditableOnLayer) &&
              fi.fieldName !== layerObject.globalIdField &&
              fi.fieldName !== layerObject.objectIdField) {
              fieldInfos.push({
                fieldName: fi.fieldName,
                label: fi.label,
                isEditable: fi.isEditable,
                visible: fi.visible,
                type: fi.fieldType
              });
            }
          });
          if (fieldInfos.length === 0) {
            fieldInfos = null;
          }
        } else {
          fieldInfos = null;
        }
        return fieldInfos;
      },

      _getFieldInfosFromWebmap: function(layerId, jimuLayerInfos) {
        var fieldInfos = null;
        var jimuLayerInfo = jimuLayerInfos.getLayerInfoByTopLayerId(layerId);
        if(jimuLayerInfo) {
          var popupInfo = jimuLayerInfo.getPopupInfo();
          if(popupInfo && popupInfo.fieldInfos) {
            fieldInfos = lang.clone(popupInfo.fieldInfos);
          }
        }

        if(fieldInfos) {
          array.forEach(fieldInfos, function(fieldInfo) {
            if(fieldInfo.format &&
              fieldInfo.format.dateFormat &&
              fieldInfo.format.dateFormat.toLowerCase() &&
              fieldInfo.format.dateFormat.toLowerCase().indexOf('time') >= 0
              ) {
              fieldInfo.format.time = true;
            }
          });
        }

        return fieldInfos;
      },

      _getFieldInfos: function (layerObject, layerInfo) {
        var fieldInfos = [];
        var wFieldInfos = this._getWebmapFieldInfos(layerObject);
        var bFieldInfos =  wFieldInfos ? wFieldInfos : this._getDefaultFieldInfos(layerObject);
        if (layerInfo && layerInfo.fieldInfos) {
          array.forEach(layerInfo.fieldInfos, function (fi) {
            if (typeof(fi.visible) === 'undefined') {
              if (wFieldInfos) {
                for (var j = 0; j < wFieldInfos.length; j++) {
                  if (fi.fieldName === wFieldInfos[j].fieldName) {
                    fi.visible = wFieldInfos[j].visible || wFieldInfos[j].isEditable;
                  }
                }
              } else {
                fi.visible = true;
              }
            }

            // keep order.
            for (var i = 0; i < bFieldInfos.length; i++) {
              if (fi.fieldName === bFieldInfos[i].fieldName) {
                fieldInfos.push(fi);
                bFieldInfos[i]._exit = true;
                break;
              }
            }
          });
          // add new fieldInfos at end.
          array.forEach(bFieldInfos, function (fi) {
            if (!fi._exit) {
              fieldInfos.push(fi);
            }
          });
        } else {
          fieldInfos = bFieldInfos;
        }
        return fieldInfos;
      },

      getConfig: function () {
        //Layer Settings
        this.config.layerSettings = {
          layerID: this.layer.id,
          symbol: this.symbolPicker.getSymbol().toJson(),
          maxRecords: this.maxRecords.getValue(),
          distance: this.searchDistance.getValue(),
          unit: this.searchUnit.getValue()
        };

        //Location Settings
        if (this._currentSourceSetting) {
          this._closeSourceSetting();
        }
        var trs = this.sourceList.getRows();
        var sources = [];
        array.forEach(trs, lang.hitch(this, function (tr) {
          var source = this._getRowConfig(tr);
          delete source._definition;
          this._removeRowConfig(tr);
          sources.push(source);
        }));

        this.config.sources = sources;

        // get layerInfos config
        var checkedLayerInfos = [];
        //trs = this._layersTable.getRows();
        //array.forEach(trs, lang.hitch(this, function (tr) {
        //  var layerInfo = this._getRowConfig(tr);
        //  var radio = query('input', tr.firstChild)[0];
        //  if (radio.checked) {
        //    array.forEach(layerInfo.fieldInfos, lang.hitch(this, function (fi) {
        //      var name = fi.fieldName;
        //      for (var i = 0; i < layerInfo.featureLayer.fields.length; i++) {
        //        var f = layerInfo.featureLayer.fields[i];
        //        if (f.name === name) {
        //          fi.type = f.type;
        //          break;
        //        }
        //      }
        //    }));
        //    checkedLayerInfos.push(layerInfo);
        //  }
        //}));
        if (checkedLayerInfos.length === 0) {
          delete this.config.layerInfos;
        } else {
          this.config.layerInfos = checkedLayerInfos;
        }
        this.config.xyFields = this.xyFields || this.config.defaultXYFields;
        this.config.xyEnabled = this.xyEnabled;

        //search radius
        return this.config;
      },

      _editFields: function () {
        if (this.xyEnabled) {
          this._editXYFieldsTableValues(this.xyFields);
        }
      },

      _editXYFieldsTableValues: function (fields) {
        var editFields = new EditFields({
          nls: this.nls,
          type: 'locatorFields',
          addressFields: fields || this.config.defaultXYFields,
          popupTitle: this.nls.configureXYFields,
          disableDisplayOption: true
        });
        this.own(on(editFields, 'edit-fields-popup-ok', lang.hitch(this, function () {
          this.xyFields = editFields.fieldInfos;
        })));
        editFields.popupEditPage();
      },

      _setXYFields: function (xyFields, config) {
        var useConfig = config && config.xyFields &&
          config.xyFields.hasOwnProperty('length') && config.xyFields.length > 0;
        this.xyFields = useConfig ? config.xyFields : xyFields;
      },

      _onAddClick: function (evt) {
        this._createNewLocatorSourceSettingFromMenuItem({}, {});
      },

      _createNewLocatorSourceSettingFromMenuItem: function (setting, definition) {
        var locatorSetting = new LocatorSourceSetting({
          nls: this.nls,
          map: this.map,
          defaultXYFields: this.config.defaultXYFields
        });
        locatorSetting.setDefinition(definition);
        locatorSetting.setConfig({
          url: setting.url || "",
          name: setting.name || "",
          singleLineFieldName: setting.singleLineFieldName || "",
          countryCode: setting.countryCode || "",
          addressFields: setting.addressFields || [],
          singleAddressFields: setting.singleAddressFields || [],
          xyFields: setting.xyFields || [],
          singleEnabled: setting.singleEnabled || false,
          multiEnabled: setting.multiEnabled || false,
          xyEnabled: setting.xyEnabled || false,
          type: "locator"
        });
        locatorSetting._openLocatorChooser();

        locatorSetting.own(
          on(locatorSetting, 'select-locator-url-ok', lang.hitch(this, function (item) {
            var addResult = this.sourceList.addRow({
              name: item.name || "New Geocoder"
            }, this.sourceList.getRows().length);
            if (addResult && addResult.success) {
              if (this._currentSourceSetting) {
                this._closeSourceSetting();
              }
              locatorSetting.setRelatedTr(addResult.tr);
              locatorSetting.placeAt(this.sourceSettingNode);
              this.sourceList.selectRow(addResult.tr);
              this._currentSourceSetting = locatorSetting;
            }
            var xy = query('.xy-table-no-locator');
            if (xy.length > 0) {
              html.removeClass(xy[0], 'xy-table-no-locator');
              html.addClass(xy[0], 'xy-table');
            }
          }))
        );
        locatorSetting.own(
          on(locatorSetting, 'reselect-locator-url-ok', lang.hitch(this, function (item) {
            var tr = this._currentSourceSetting.getRelatedTr();
            this.sourceList.editRow(tr, {
              name: item.name
            });
          }))
        );
        locatorSetting.own(
          on(locatorSetting, 'select-locator-url-cancel', lang.hitch(this, function () {
            if (this._currentSourceSetting !== locatorSetting) {// locator doesn't display in UI
              locatorSetting.destroy();
              locatorSetting = null;
            }
          }))
        );
      },

      _createNewLocatorSourceSettingFromSourceList: function (setting, definition, relatedTr) {
        if (this._currentSourceSetting) {
          this._closeSourceSetting();
        }

        this._currentSourceSetting = new LocatorSourceSetting({
          nls: this.nls,
          map: this.map,
          defaultXYFields: this.config.defaultXYFields
        });
        this._currentSourceSetting.setDefinition(definition);
        this._currentSourceSetting.setConfig({
          url: setting.url || "",
          name: setting.name || "",
          singleLineFieldName: setting.singleLineFieldName || "",
          countryCode: setting.countryCode || "",
          addressFields: setting.addressFields,
          singleAddressFields: setting.singleAddressFields,
          xyFields: setting.xyFields,
          singleEnabled: setting.singleEnabled,
          multiEnabled: setting.multiEnabled,
          xyEnabled: setting.xyEnabled,
          type: "locator"
        });
        this._currentSourceSetting.setRelatedTr(relatedTr);
        this._currentSourceSetting.placeAt(this.sourceSettingNode);

        this._currentSourceSetting.own(
          on(this._currentSourceSetting,
            'reselect-locator-url-ok',
            lang.hitch(this, function (item) {
              var tr = this._currentSourceSetting.getRelatedTr();
              this.sourceList.editRow(tr, {
                name: item.name
              });
            }))
        );
      },

      _onSourceItemRemoved: function (tr) {
        if (!this._currentSourceSetting) {
          return;
        }
        var currentTr = this._currentSourceSetting.getRelatedTr();
        if (currentTr === tr) {
          this._currentSourceSetting.destroy();
          this._currentSourceSetting = null;
        }
        var rows = this.sourceList.getRows();
        if (rows.length > 0) {
          this._onSourceItemSelected(rows[0]);
        } else {
          var xy = query('.xy-table');
          if (xy.length > 0) {
            html.removeClass(xy[0], 'xy-table');
            html.addClass(xy[0], 'xy-table-no-locator');
          }
        }
      },

      _onSourceItemSelected: function (tr) {
        var config = this._getRowConfig(tr);
        var currentTr = this._currentSourceSetting && this._currentSourceSetting.tr;
        if (!config || tr === currentTr) {
          return;
        }
        if (this._currentSourceSetting && !this._currentSourceSetting.isValidConfig()) {
          this._currentSourceSetting.showValidationTip();
          this.sourceList.selectRow(currentTr);
          return;
        }
        this._createNewLocatorSourceSettingFromSourceList(config, config._definition || {}, tr);
      },

      _setRowConfig: function (tr, source) {
        query(tr).data('config', lang.clone(source));
      },

      _getRowConfig: function (tr) {
        return query(tr).data('config')[0];
      },

      _removeRowConfig: function (tr) {
        return query(tr).removeData('config');
      },

      _closeSourceSetting: function () {
        var tr = this._currentSourceSetting.getRelatedTr();
        var source = this._currentSourceSetting.getConfig();
        source._definition = this._currentSourceSetting.getDefinition();
        this._setRowConfig(tr, source);
        this.sourceList.editRow(tr, {
          name: source.name
        });
        this._currentSourceSetting.destroy();
      },

      _disableOk: function () {
        var s = query(".button-container")[0];
        var s2 = s.children[2];
        var s3 = s.children[3];
        domStyle.set(s2, "display", "none");
        domStyle.set(s3, "display", "inline-block");
      },

      _enableOk: function () {
        var s = query(".button-container")[0];
        var s2 = s.children[2];
        var s3 = s.children[3];
        domStyle.set(s2, "display", "inline-block");
        domStyle.set(s3, "display", "none");
      }
    });
  });
