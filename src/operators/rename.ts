import { Operator, OperatorOptions, OperatorValidator } from '../operator';

export interface RenameOperatorOptions extends OperatorOptions {
  properties: { [key: string]: string };
}

export class RenameOperator implements Operator {
  static specification = {
    index: { required: false, type: ['number'] },
    properties: { required: true, type: ['object'] },
  };

  readonly index: number;

  readonly properties: { [key: string]: string };

  constructor(public options: RenameOperatorOptions) {
    const { index = 0, properties = {} } = options;
    this.index = index;
    this.properties = properties;
  }

  handleRename(data: { [key: string]: string }) {
    const props = Object.getOwnPropertyNames(this.properties);
    for (let i = 0; i < props.length; i += 1) {
      const oldKey = props[i];
      const newKey = this.properties[oldKey];
      const val = data[oldKey];
      delete data[oldKey]; // eslint-disable-line no-param-reassign
      data[newKey] = val; // eslint-disable-line no-param-reassign
    }
  }

  handleData(data: any[]): any[] | null {
    if (typeof data[this.index] !== 'object') {
      throw new Error('Can only convert property names on objects');
    }
    const converted: { [key: string]: any } = { ...data[this.index] };
    this.handleRename(converted);
    const clone = data.slice();
    clone.splice(this.index, 1, converted);
    return clone;
  }

  validate() {
    const validator = new OperatorValidator(this.options);
    validator.validate(RenameOperator.specification);
    const { properties } = this.options;
    if (Object.getOwnPropertyNames(properties).length === 0) {
      validator.throwError('properties', 'at least one property must be renamed');
    }
    const props = Object.getOwnPropertyNames(properties);
    for (let i = 0; i < props.length; i += 1) {
      if (typeof properties[props[i]] !== 'string') {
        validator.throwError('properties', 'can only rename to string values');
      }
    }
  }
}
