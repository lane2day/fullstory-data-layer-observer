import { Logger } from "./utils/logger";
import { Operator, OperatorOptions } from "./operator";
import { DataLayerEventType, DataLayerDetail, PropertyDetail } from "./event";
import { fromPath } from "./utils/object";

/**
 * DataHandler listens for changes from lower level PropertyListeners. Events emitted from PropertyListeners
 * are inspected, and valid event data is transformed through a series of registered operators.
 */
export class DataHandler {

  private operators: Operator<OperatorOptions>[] = [];

  readonly target: any;
  readonly property: string;

  debug = false;  // NOTE debugging is done at a rule level, which is why Logger is not used

  // external tooling can override the console debugger
  debugger = (message: string, data?: any, indent?: string) =>
    console.debug(data ? `${indent}${message}\n${indent}${JSON.stringify(data)}` : `${indent}${message}`);

  /**
   * Creates a DataHandler.
   * @param path the string path to the data layer (used to identify which data layer emitted data)
   * @param target the data layer (i.e. object)
   * @param property the property or function to be handled
   * @throws will throw an error if the data layer is not found (i.e. undefined or null)
   */
  constructor(public readonly path: string, target?: any, property?: string) {
    // TODO (van) parse the path using the query syntax when it is completed
    this.target = !target ? fromPath(path)[0] : target;
    this.property = !property ? fromPath(path)[1] : property;

    // guards against trying to register an observer on a non-existent datalayer
    // this could happen if the data layer is dynamically loaded after DLO starts
    if (!this.target || !this.target[this.property]) {
      throw new Error(`Data layer ${path} not found on page`);
    }
  }

  /**
   * Manually emit the current value of the observed target property.
   * @throws will throw an error if the target's property is not an object
   */
  fireEvent() {
    const type = typeof this.target[this.property];

    if (type === 'object') {
      this.handleEvent(new CustomEvent<DataLayerDetail>(DataLayerEventType.PROPERTY, {
        detail: new PropertyDetail(this.target, this.target[this.property], this.path)
      }));
    } else {
      throw new Error(`${this.path} (${type}) is not a supported type`);
    }
  }

  /**
   * Handles the incoming event. This function implements EventListener to also support addEventListener()
   * browser APIs and Data Layer Observer events.
   * @param event a browser Event or CustomEvent emitted
   */
  handleEvent(event: CustomEvent<DataLayerDetail>): void {
    const { detail: { args, value, path }, type } = event;

    // since window is the event dispatcher, use the path in DataLayerDetail to decide if this DataHandler
    // should process the data
    if (this.path === path) {
      if (value === undefined && args === undefined) {
        Logger.getInstance().warn(`${this.path} emitted no data`, this.path);
      } else {
        switch (type) {
          case DataLayerEventType.PROPERTY:
            this.handleData([value]);
            break;
          case DataLayerEventType.FUNCTION:
            this.handleData(args || []);
            break
          default:
            Logger.getInstance().warn(`Unknown event type ${type}`);
        }
      }
    }
  }

  /**
   * Sequentially process the list of operators.
   * @param data the data as an array of values emitted from the data layer
   */
  private handleData(data: any[] | null): any[] | null {
    this.runDebugger(`${this.path} handleData entry`, data);

    for (let i = 0; i < this.operators.length; i++) {
      const { name } = this.operators[i];

      try {
        // if the data is null, it is a signal to stop processing
        // this can happen if an upstream handler needed to prevent a downstream operator (e.g filter use-case)
        if (data === null) {
          this.runDebugger(`[${i}] ${name} halted`, data, '  ');
          return null;
        } else {
          data = this.operators[i].handleData(data);
          this.runDebugger(`[${i}] ${name} output`, data, '  ');
        }
      } catch (err) {
        Logger.getInstance().error(`Operator ${name} failed for ${this.path} at step ${i}`, this.path);
        console.error(err.message);
        return null;
      }
    }

    this.runDebugger(`${this.path} handleData exit`, data);

    return data;
  }

  private runDebugger(message: string, data?: any, indent = '') {
    if (this.debug) {
      this.debugger(message, data, indent);
    }
  }

  /**
   * Adds an operator to the list. Operators will sequentially pass data to the next operator.
   * @param operators Operator(s) to add
   */
  push(...operators: Operator<OperatorOptions>[]): void {
    operators.forEach(operator => this.operators.push(operator));
  }
}