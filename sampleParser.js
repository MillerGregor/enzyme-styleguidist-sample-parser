// @flow
import React from "react";
import { mount, render, shallow } from "enzyme";
import capitalize from "lodash.capitalize";
import cloneDeep from "lodash.clonedeep";
import each from "lodash.foreach";
import loGet from "lodash.get";
import jsxToString from "react-element-to-jsx-string";
import StringBuilder from "string-builder";
import path from "path";
import fs from "fs";
import fse from "fs-extra";
import log from "loglevel";

const HEADER = `\n[//]: # (** auto-generated ${new Date().toISOString()} **)\n`;
const METHODS = "methods";
const PROPS = "props";

function smallUUID(a) {
  return a
    ? (a ^ ((Math.random() * 16) >> (a / 4))).toString(16)
    : ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, smallUUID);
}

export function genRefId() {
  const id = smallUUID().replace(/-/g, "");
  return `ref${id}`;
}

export function assignRef(refId) {
  return Function("ref", `return ${refId} = ref`);
}

const _defaultCreateWrapper = (depth, jsx) => {
  let wrapper;
  switch (depth) {
    case "mount":
      wrapper = mount(jsx);
      break;
    case "shallow":
      wrapper = shallow(jsx);
      break;
    case "render":
      wrapper = render(jsx);
      break;
    default:
  }
  return wrapper;
};

const _defaultBuildJsx = attr => {
  try {
    const jsx = React.createElement(attr.component, attr.props, attr.children);
    return jsx;
  } catch (err) {
    log.error(err);
  }
};

const _defaultJsxToString = jsx => {
  return jsxToString(jsx, {
    showFunctions: true,
    showDefaultProps: false
  });
};

const _processAttribute = (attr, opts) => {
  let exampleWritten = false;
  if (opts.enzyme && opts.enzyme.run) {
    // let buildJsx = loGet(attr, "enzyme.buildJsx");
    // if (!buildJsx) buildJsx = _defaultBuildJsx;
    const jsx = _defaultBuildJsx(attr);
    log.debug({ attr });
    each(loGet(attr, "enzyme.tests", {}), (depth, depthName) => {
      log.debug({ depthName, depth });
      each(depth, (jestTest, testName) => {
        log.debug({ attr });
        const title = attr.title.concat(" enzyme-", depthName, ": ", testName);
        const wrapper = loGet(
          opts,
          "enzyme.createWrapper",
          _defaultCreateWrapper
        )(depthName, jsx);
        jestTest(wrapper, title, attr.attrName);
      });
    });
  }
  if (opts.styleguidist && opts.styleguidist.build) {
    attr.stringBuilder.appendLine("\n#### " + attr.displayName);
    attr.stringBuilder.append("\n```js\n");
    if (opts.styleguidist && opts.styleguidist.script)
      attr.stringBuilder.appendLine(opts.styleguidist.script);
    let jsx = "";
    if (!loGet(attr, "styleguidist.getJsxString")) {
      jsx = loGet(attr, "styleguidist.buildJsx", _defaultBuildJsx)(attr);
    }
    const jsxString = loGet(
      attr,
      "styleguidist.getJsxString",
      _defaultJsxToString
    )(jsx);
    attr.stringBuilder.appendLine(jsxString);
    attr.stringBuilder.appendLine("\n```\n");
    exampleWritten = true;
    test(attr.title + " example file written", () => {
      expect(exampleWritten).toBeTruthy();
    });
  }
};

const _processComponent = (compSect, opts) => {
  log.debug({ compSect });
  each(compSect.samples, (attrDefs, attrTypeName) => {
    log.debug({ attrTypeName });
    let descTitle = compSect.title.concat(" ", capitalize(attrTypeName));
    if (opts.styleguidist && opts.styleguidist.build) {
      descTitle = descTitle.concat(" Styleguide Examples");
      compSect.stringBuilder.appendLine("\n### " + attrTypeName + "\n");
    }
    describe(descTitle, () => {
      each(attrDefs, (attr, attrName) => {
        attr.attrType = attrTypeName;
        attr.attrName = attrName;
        attr.displayName = attrName.concat(
          attrTypeName === METHODS ? "()" : ""
        );
        attr.title = compSect.title.concat(
          ` [ ${attrTypeName.slice(0, -1)}:`,
          ` ${attr.displayName}`,
          " ]"
        );

        if (opts.styleguidist && opts.styleguidist.build) {
          attr.stringBuilder = compSect.stringBuilder;
        }

        _processAttribute(attr, opts);
      });
    });
  });
};

const _processSection = (section, opts) => {
  log.debug({ section });
  each(section.sectionComponents, (compSect, name) => {
    compSect.title = section.title.concat(": ", name, ":");
    if (opts.styleguidist && opts.styleguidist.build) {
      compSect.exampleFileName = path
        .join(opts.styleguidist.examplesDir, name)
        .concat(".md");
      compSect.stringBuilder = new StringBuilder();
      compSect.stringBuilder.appendLine(HEADER);
    }
    _processComponent(compSect, opts);
    if (opts.styleguidist && opts.styleguidist.build)
      fse.outputFileSync(compSect.exampleFileName, compSect.stringBuilder);
  });
};

export default function parseSamples(sections: Object, options: Object) {
  if (options.log) log.setLevel(options.log);
  else log.setLevel(`WARN`);

  log.debug({ options });
  log.debug({ sections });
  each(sections, (section, sectionKey) => {
    // guide first to avoid the mocks
    if (options.styleguidist && options.styleguidist.build) {
      const guideOpts = cloneDeep(options);
      delete guideOpts.enzyme;
      log.info(`Styleguide: processing Section: ${sectionKey}`);
      _processSection(section, guideOpts);
    }

    if (options.enzyme && options.enzyme.run) {
      const testOpts = cloneDeep(options);
      delete testOpts.styleguidist;
      if (options.mocks) options.mocks();
      _processSection(section, testOpts);
    }
  });
}
