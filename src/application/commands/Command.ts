/**
 * Base command interface
 */
export interface ICommand<TResult = void> {
  execute(): Promise<TResult>;
}

/**
 * Command handler interface
 */
export interface ICommandHandler<TCommand extends ICommand, TResult = void> {
  handle(command: TCommand): Promise<TResult>;
}

/**
 * Command bus interface
 */
export interface ICommandBus {
  execute<TResult>(command: ICommand<TResult>): Promise<TResult>;
  register<TCommand extends ICommand, TResult>(
    commandType: new (...args: unknown[]) => TCommand,
    handler: ICommandHandler<TCommand, TResult>
  ): void;
}