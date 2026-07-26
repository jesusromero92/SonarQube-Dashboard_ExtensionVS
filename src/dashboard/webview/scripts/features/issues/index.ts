import { ISSUE_ACTIONS_SCRIPT } from './actions';
import { ISSUE_ACTIVITY_SCRIPT } from './activity';
import { ISSUE_FLOWS_SCRIPT } from './flows';
import { ISSUE_LIFECYCLE_SCRIPT } from './lifecycle';
import { ISSUE_STATE_SCRIPT } from './state';

export const ISSUE_MANAGEMENT_SCRIPT = [
  ISSUE_STATE_SCRIPT,
  ISSUE_ACTIVITY_SCRIPT,
  ISSUE_FLOWS_SCRIPT,
  ISSUE_ACTIONS_SCRIPT,
  ISSUE_LIFECYCLE_SCRIPT
].join('');
