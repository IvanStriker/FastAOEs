/*
let CONFIG = {
  DND5E: {
    damageTypes: {
      "fire": {
        "label": "Fire"
      },
      "cold": {
        "label": "Cold"
      }
    },
    conditionTypes: {
      "stunned": {
        "label": "Stunned"
      }
    },
    abilities: {
      "str": {
        "label": "Strength",
        "abbreviation": "Str"
      }
    }
}
};

class FormApplication {

  constructor(object) {
    Object.assign(this.object, object);
  }

  static get defaultOptions() {
    return {superOpt: "Option"};
  }

  activateListeners() {
    console.log("Super activateListeners");
  }

  async submit() {
    console.log("Super submit");
  }

  async close() {
    console.log("Super close");
  }

}

let game = {
  i18n: {
    localize(str) {
      return "Русские " + str;
    }
  }
}

let foundry = {
  utils: {
    mergeObject(obj1, obj2) {
      obj1 = {
        ...obj1,
        ...obj2
      };
    },

    expandObject(obj) {
      let res = {};
      for (let [key, val] of Object.entries(obj)) {
        let tempArr = key.split(".");
        let last = val;
        for (let i = tempArr.length - 1; i >= 1; --i) {
          last = {
            [tempArr[i]]: last
          };
        }
        res[tempArr[0]] = last;
      }
      obj = res;
    }
  }
}

class HTML {

  constructor(html) {
    this.html = html;
  }

  on(event, selector, callback) {
    if (!this.html) return;
    for (let item of this.html.querySelectorAll(selector)) {
      item.addEventListener(event, callback);
    }
  }

  find(selector) {
    if (!this.html) return;
    return new HTML(this.html.querySelector(selector));
  }

  append(str) {
    if (!this.html) return;
    let temp = document.createElement('button');
    temp.innerHTML = str;
    this.html.append(temp);
  }


}

class Actor {

  constructor() {
    this.system = {
      traits: {
        di: new Set()
      },
      resources: {
        legres: {
          value: 1
        }
      }
    }
  }

  rollAbilitySave(ability) {
    console.log(`rolling ${ability}`);
    return {
      total: 13
    }
  }

  applyDamage(obj) {
    console.log(`applied damage: ${obj.value} of type ${obj.type}`);
    return null;
  }

}

class Token {
  constructor() {
    this.actor = new Actor();
  }
}

let canvas = {
  tokens: {
    controlled: [new Token(), new Token()]
  }
}

let Hooks = {
  once(event, callback) {
    callback(event, new HTML(document));
  },

  on(event, callback) {
    callback(event, new HTML(document));
  }
}
*/
//The beginning...


/**
 * A class containing all the global variables
 */
class AOEManager {

  static ID = "aoe-manager";

  static TEMPLATE = `templates\\${this.ID}.hbs`;

  static DAMAGE_TYPES;

  static CONDITIONS;

  static ABILITIES;

}

/**
 * @typedef {Object} AOESpell
 * @property {number} damage - the amount of damage
 * @property {Object} damageType
 * @property {Object} condition
 * @property {number} savingThrowDC - the saving throw difficulty
 * @property {Object} savingThrow - the type of the saving throw
 */

/**
 * A class that represents forms which allow to customize the current AOE settings
 */

class AOEConfig extends FormApplication {

  static get defaultOptions() {
    const start_settings = super.defaultOptions;
    const new_settings = {
      width: 600,
      height: "auto",
      popOut: true,
      resizable: true,
      id: AOEManager.ID,
      title: game.i18n.localize('AOE-MANAGER.window-title'),
      template: AOEManager.TEMPLATE
    };
    return foundry.utils.mergeObject(start_settings, new_settings);
  }

  constructor() {
    super({
      damage: 0,
      damageType: AOEManager.DAMAGE_TYPES.Fire.label,
      condition: null,
      savingThrowDC: 0,
      savingThrow: AOEManager.ABILITIES.Str.label
    });
  }

  getData(options) {
    return {
      ...this.object,
      damageTypes: AOEManager.DAMAGE_TYPES,
      conditions: AOEManager.CONDITIONS,
      abilities: AOEManager.ABILITIES
    }
  }

  async _updateObject(event, formData) {
    let expandedData = foundry.utils.expandObject(formData);
    foundry.utils.mergeObject(this.object, expandedData);
  }

  async activateListeners(html) {
    super.activateListeners(html);
    html.on('click', '[data-action="apply"]', this._handleApplyButtonClick.bind(this));
    html.on('click', '[data-action="back"]', this._handleBackButtonClick.bind(this));
  }

  async _handleApplyButtonClick(event) {
    await this.submit();
    await this.close();
    for (let token of canvas.tokens.controlled) {
      let currActor = token.actor;
      if (this.object.damage === 0 || currActor.system.traits.di.has
        (AOEManager.DAMAGE_TYPES[this.object.damageType].value)) {
          continue;
        }

      let checkRes =
        await currActor.rollAbilitySave(AOEManager.ABILITIES[this.object.savingThrow].value).total;

      if (checkRes >= +this.object.savingThrowDC || _tryToSpendLr(currActor)) {
        currActor.applyDamage({
          value: Math.floor(+this.object.damage / 2),
          type: AOEManager.DAMAGE_TYPES[this.object.damageType].value
        });
      } else {
        currActor.applyDamage({
          value: +this.object.damage,
          type: AOEManager.DAMAGE_TYPES[this.object.damageType].value
        });
      }
    }
  }

  async _tryToSpendLr(currActor) {
    if (!currActor.system?.resources?.legres?.value) return false;
    let res = await _requestLrUsage(currActor);
    if (res) {
      currActor.system.resources.legres.value -= 1;
    }
    return res;
  }

  async _requestLrUsage(currActor) {
    let res = true;
    let d = await Dialog.confirm({
       title: game.i18n.localize("AOE-MANAGER.LR-window-title"),
       content: game.i18n.localize("AOE-MANAGER.LR-window-text"),
       yes: () => {res = true},
       no: () => {res = false},
       defaultYes: false
    });
    return res;
  }

  async _handleBackButtonClick(event) {
    await this.close();
  }
}

Hooks.once("init", () => {

    AOEManager.DAMAGE_TYPES = Object.entries(CONFIG.DND5E.damageTypes).reduce((accum, curr) => {
      return {
        ...accum,
        [curr[1].label]: {label: curr[1].label, value: curr[0]}
      };
    }, {});

    AOEManager.CONDITIONS = Object.entries(CONFIG.DND5E.conditionTypes).reduce((accum, curr) => {
      return {
        ...accum,
        [curr[1].label]: {label: curr[1].label, value: curr[0]}
      };
    }, {});

    AOEManager.ABILITIES = Object.entries(CONFIG.DND5E.abilities).reduce((accum, curr) => {
      return {
        ...accum,
        [curr[1].abbreviation]: {label: curr[1].label, value: curr[0]}
      };
    }, {});

});

Hooks.on('renderSceneControls', (trash, html) => {
    html.find(`.main-controls`).append(`<li class="scene-control" data-control="AOE">AOE</li>`);
    html.find(`[data-control="AOE"]`).on('click', () => {
        new AOEConfig().render(true);
    });
});
