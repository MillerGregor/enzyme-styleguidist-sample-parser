// @flow
import React from "react";
import { mount, render, shallow } from "enzyme";
import jsdom from "jsdom";
import cloneDeep from "lodash.clonedeep";
import each from "lodash.foreach";
import merge from "lodash.merge";
import log from "loglevel";

log.setLevel(`INFO`);

const buildCtxOptions = ctxArr => {
  let options = { context: {}, childContextTypes: {} };
  ctxArr.forEach(ctx => {
    if (ctx.type && ctx.type === "func") {
      const mockFunc = jest.fn();
      mockFunc.mockReturnValue(ctx.value);
      options = merge(options, {
        context: { [ctx.name]: mockFunc },
        childContextTypes: { [ctx.name]: toPropType(ctx.type) }
      });
    }
  });
  return options;
};

const toPropType = typeId => {
  switch (typeId) {
    case "func":
      return PropTypes.func;
    default:
      return null;
  }
};

const wrapJsx = (depthName, jsx, ctx) => {
  let wrapper;
  let ctxOpts = {};
  if (ctx) ctxOpts = buildCtxOptions(ctx);
  switch (depthName) {
    case "mount":
      wrapper = mount(jsx, ctxOpts);
      break;
    case "shallow":
      delete ctxOpts.childContextTypes;
      wrapper = shallow(jsx, ctxOpts);
      break;
    case "render":
      wrapper = render(jsx);
      break;
    default:
  }
  return wrapper;
};

const setupJsDom = () => {
  const doc = jsdom.jsdom("<!doctype html><html><body></body></html>");
  global.document = doc;
  global.window = doc.defaultView;
};

const _processAttribute = (opts, attr) => {
  log.debug({ opts, attr });
  if (opts.tests) {
    each(attr.tests, (depth, depthName) => {
      each(depth, (jestTest, testName) => {
        const title = opts.title.concat(" enzyme-", depthName, ": ", testName);
        if (opts.tests) {
          const jsx = React.createElement(opts.component, attr.props);
          const wrapper = wrapJsx(depthName, jsx);
          jestTest(wrapper, title, opts.attrName);
        }
      });
    });
  }
};

const _processComponent = (opts, component) => {
  log.debug({ component });
  if (opts.tests) {
    beforeEach(setupJsDom);
  }
  describe(opts.title.concat(" Props"), () => {
    each(component.samples.props, (prop, propName) => {
      log.debug({ propName });
      const propOpts = cloneDeep(opts);
      propOpts.component = component.component;
      propOpts.title = opts.title.concat(" [ prop: ", propName, " ]");
      propOpts.attrName = propName;
      _processAttribute(propOpts, prop);
    });
  });
  describe(opts.title.concat(" Methods"), () => {
    each(component.samples.methods, (method, methodName) => {
      log.debug({ methodName });
      const methodOpts = cloneDeep(opts);
      methodOpts.component = component.component;
      methodOpts.title = opts.title.concat(" [ method: ", methodName, "() ]");
      methodOpts.attrName = methodName;
      _processAttribute(methodOpts, method);
    });
  });
};

const _processSection = (opts, section) => {
  log.debug({ section });
  each(section.sectionComponents, (component, componentName) => {
    let clonedOpts = cloneDeep(opts);
    clonedOpts.title = section.title.concat(": ", componentName, ":");
    _processComponent(clonedOpts, component);
  });
};

export function runTests(section: Object, opts: Object) {
  log.debug({ section });
  const testOpts = { ...opts, tests: true };

  console.warn(new Date().getTime());

  // mocking
  // $FlowExpectedError
  Date.now = jest.fn(() => -3580994563);

  // not yet working
  // const travelInTime = (ms, step = 100) => {
  //   const tickTravel = v => {
  //     jest.runTimersToTime(v);
  //     const now = Date.now();
  //     MockDate.set(new Date(now + v));
  //   };

  //   let done = 0;
  //   while (ms - done > step) {
  //     tickTravel(step);
  //     done += step;
  //   }
  //   tickTravel(ms - done);
  // };

  _processSection(testOpts, section);
}

export function buildGuide(sections: Object, opts: Object) {
  each(sections, (section, sectionName) => {
    log.debug({ sectionName });
    _processSection(opts, section);
  });
}
