import { ACCORDION_STYLES } from './components/accordion';
import { COMMENT_COMPOSER_STYLES } from './components/commentComposer';
import { DIALOG_COMPONENT_STYLES } from './components/dialog';
import { DISCLOSURE_STYLES } from './components/disclosure';
import { FORM_COMPONENT_STYLES } from './components/forms';
import { ICON_BUTTON_STYLES } from './components/iconButton';
import { SELECT_DROPDOWN_STYLES } from './components/selectDropdown';
import { TABLE_HELPER_STYLES } from './components/tableHelpers';
import { COVERAGE_FEATURE_STYLES } from './features/coverage';
import { ISSUE_FEATURE_STYLES } from './features/issues';
import { QUALITY_GATE_FEATURE_STYLES } from './features/qualityGate';
import { RULE_FEATURE_STYLES } from './features/rules';

export function getDashboardDesignStyles(): string {
  return [
    ICON_BUTTON_STYLES,
    SELECT_DROPDOWN_STYLES,
    FORM_COMPONENT_STYLES,
    DISCLOSURE_STYLES,
    ACCORDION_STYLES,
    COMMENT_COMPOSER_STYLES,
    DIALOG_COMPONENT_STYLES,
    TABLE_HELPER_STYLES,
    ISSUE_FEATURE_STYLES,
    COVERAGE_FEATURE_STYLES,
    QUALITY_GATE_FEATURE_STYLES,
    RULE_FEATURE_STYLES
  ].join('');
}
