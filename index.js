import {generateUniquePrefix, prefixAllRules} from '../maskingtape.css/c3s.js';
import {addInsertListener, addRemovedListener, monitorChanges} from './monitorChanges.js';
import DEFAULT_SHEILD from './shield.js';

const Options = {shield:DEFAULT_SHIELD};
const stylistFunctions = new Map();
const mappings = new Map();
const memory = {state: {}};

export function setState(newState) {
  const clonedState = clone(newState);
  Object.assign(memory.state,newState);
}

export function restyleElement(el) {
  el.classList.forEach(className => className.startsWith('c3s') && restyleClass(className));
}

export function restyleClass(className) {
  const {element,stylist} = mappings.get(className);
  associate(className, element, stylist, memory.state);
}

export function restyleAll() {
  mappings.forEach(({element,stylist}, className) => {
    associate(className, element, stylist, memory.state);
  });
}

export function initializeDSS(state, functionsObject, options) {
  const {shield} = options;

  if ( !! shield && typeof shield == "string" ) {
    Object.assign(Options, {shield});
  } 

  setState(state);
  /** 
    to REALLY prevent FOUC put this style tag BEFORE any DSS-styled markup
    and before any scripts that add markup, 
    and before the initializeDSS call
  **/
  document.head.insertAdjacentHTML('afterBegin', `
    <style data-role="prevent-fouc">
      [stylist]:not([associated]) {
        display: none !important;
      }
    </style>
  `);
  addMoreStylistFunctions(functionsObject, options); 
  addInsertListener(associateStylistFunctions);
  addRemovedListener(unassociateStylistFunctions);
  monitorChanges();
  const initialEls = Array.from(document.querySelectorAll('[stylist]'));
  associateStylistFunctions(...initialEls);

  return;

  function associateStylistFunctions(...els) {
    els = els.filter(el => el.hasAttribute('stylist'));
    if ( els.length == 0 ) return;
    for ( const el of els ) {
      const stylistNames = (el.getAttribute('stylist') || '').split(/\s+/g);
      for ( const stylistName of stylistNames ) {
        const stylist = stylistFunctions.get(stylistName);
        if ( ! stylist ) throw new TypeError(`Stylist named by ${stylistName} is unknown.`);
        const className = randomClass();
        el.classList.add(className);
        associate(className, el, stylist, state);
      }
    }
  }
}

// an object whose properties are functions that are stylist functions
export function addMoreStylistFunctions(functionsObject) {
  const toRegister = [];
  for ( const funcName of Object.keys(functionsObject) ) {
    const value = functionsObject[funcName];
    if ( typeof value !== "function" ) throw new TypeError("Functions object must only contain functions.");
    // this prevents a bug where we miss an existing style element in 
    // a check for a style element based on the stylist.name property
    if ( value.name !== funcName ) throw new TypeError(`Stylist function must be actual function named ${funcName} (it was ${value.name})`);

    // don't overwrite exisiting names
    if ( !stylistFunctions.has(funcName) ) {
      toRegister.push(() => stylistFunctions.set(funcName,value));
    }
  }
  while(toRegister.length) toRegister.pop()();
}

function randomClass() {
  const {prefix:[className]} = generateUniquePrefix();
  return className;
}

function associate(className, element, stylist, state) {
  let changes = true;
  if (!mappings.has(className)) {
    mappings.set(className, {element,stylist});
  }
  const styleText = Options.shield + (stylist(element, state) || '');
  let styleElement = document.head.querySelector(`style[data-stylist="${stylist.name}"]`);
  if ( !styleElement ) {
    const styleMarkup = `
      <style data-stylist="${stylist.name}" data-prefix="${className}">
        ${styleText}
      </style>
    `;
    document.head.insertAdjacentHTML('beforeEnd', styleMarkup);
    styleElement = document.head.querySelector(`style[data-prefix="${className}"]`);
  } else if ( styleElement.innerHTML !== styleText ) {
    styleElement.innerHTML = styleText;
  } else {
    changes = false;
  }
  // only prefix if we have not already
  if ( changes ) {
    const styleSheet = styleElement.sheet;
    prefixAllRules(styleSheet, "." + className, '');
    element.setAttribute('associated', 'true');
  }
}

function disassociate(className, element) {
  const styleSheet = document.querySelector(`style[data-prefix="${className}"]`); 
  mappings.delete(className);
  if ( !! styleSheet ) {
    element.classList.remove(className);
    styleSheet.remove();
  }
}

function unassociateStylistFunctions(...els) {
  els = els.filter(el => el.hasAttribute('stylist'));
  if ( els.length == 0 ) return;
  for ( const el of els ) {
    el.classList.forEach(className => className.startsWith('c3s') && disassociate(className, el));
  }
}

function clone(o) {
  return JSON.parse(JSON.stringify(o)); 
}
