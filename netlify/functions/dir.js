import { expressProxy } from './_shared/expressProxy.js';

export const handler = (event, context) => expressProxy(event, context);
