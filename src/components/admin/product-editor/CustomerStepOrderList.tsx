'use client';

import { useState } from 'react';
import { ArrowDown, ArrowUp, GripVertical } from 'lucide-react';
import FormField from '@/components/design-system/FormField';
import StatusBadge from '@/components/design-system/StatusBadge';
import type { ProductDetails } from '@/app/admin/menu-management/interfaces';
import type { CustomerCompositionRole, CustomerStepManifest, MenuSection } from '@/types/menu';
import type { CustomerStepScreen } from '@/utils/customerStepManifest';
import { canChangeCustomerScreenRole, reorderCustomerScreens } from '@/utils/customerStepEditor';
import { groupCustomerStepScreens } from '@/utils/customerStepManifest';
import { roleLabel, screenInfo, screenIsRequired, SectionParentField, StepIcon } from './customerStepOrderList.helpers';
import styles from './CustomerStepOrderList.module.css';

type EditableRole = Exclude<CustomerCompositionRole, 'Unknown'>;

const ROLE_OPTIONS: Record<CustomerStepScreen['kind'], readonly EditableRole[]> = {
  ProductVariation: ['Dish', 'RequiredChoice'],
  ProductIngredient: ['Ingredient', 'Extra'],
  ProductCustomizationGroup: ['RequiredChoice', 'Extra'],
  ProductSauce: ['Sauce', 'Extra'],
  ProductSuggestedSide: ['Side', 'Drink'],
  BundleSection: ['Menu', 'Dish', 'RequiredChoice', 'Extra', 'Side', 'Drink'],
  BundleComponentVariation: ['Dish', 'RequiredChoice'],
  BundleComponentIngredient: ['Ingredient', 'Extra'],
  BundleComponentCustomizationGroup: ['RequiredChoice', 'Extra'],
  BundleComponentSauce: ['Sauce', 'Extra'],
  BundleComponentSide: ['Side', 'Drink'],
};

interface Props {
  readonly manifest: CustomerStepManifest;
  readonly sections: readonly MenuSection[];
  readonly product: ProductDetails;
  readonly isBundle: boolean;
  readonly disabled: boolean;
  readonly invalid: boolean;
  readonly onMove: (screenId: string, targetIndex: number) => CustomerStepManifest | null | void;
  readonly onRoleChange: (screen: CustomerStepScreen, role: Exclude<CustomerCompositionRole, 'Unknown'>) => void;
  readonly onLabelChange: (screen: CustomerStepScreen, label: string | null) => void;
  readonly onSectionParentChange: (sectionId: string, parentComponentId: string | null) => void;
  readonly t: (key: string, options?: Record<string, unknown>) => string;
}

export default function CustomerStepOrderList({
  manifest,
  sections,
  product,
  isBundle,
  disabled,
  invalid,
  onMove,
  onRoleChange,
  onLabelChange,
  onSectionParentChange,
  t,
}: Props) {
  const screens = groupCustomerStepScreens(manifest);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  return (
    <div className={styles.listWrap}>
      <ol className={styles.list} aria-label={t('customer_step_order')}>
        {screens.map((screen, index) => {
          const info = screenInfo(screen, sections, product, t);
          const required = screenIsRequired(screen, sections, product);
          const unknown = screen.compositionRole === 'Unknown';
          const canMoveUp = index > 0 && Boolean(reorderCustomerScreens(manifest, screen.id, index - 1, sections));
          const canMoveDown =
            index < screens.length - 1 && Boolean(reorderCustomerScreens(manifest, screen.id, index + 1, sections));
          const dependencyBlocked =
            !disabled && !invalid && ((index > 0 && !canMoveUp) || (index < screens.length - 1 && !canMoveDown));
          const dependencyHintId = `customer-step-dependency-${index}`;
          const commitMove = (screenId: string, to: number) => {
            if (!reorderCustomerScreens(manifest, screenId, to, sections)) {
              setAnnouncement(t('customer_order_dependency_blocked'));
              return;
            }
            if (onMove(screenId, to) === null) {
              setAnnouncement(t('customer_order_dependency_blocked'));
              return;
            }
            setAnnouncement(t('customer_order_updated'));
          };
          const move = (to: number) => commitMove(screen.id, to);
          return (
            <li
              key={screen.id}
              className={`${styles.row} ${draggedId === screen.id ? styles.dragging : ''}`}
              draggable={!disabled && !invalid}
              onDragStart={(event) => {
                if (disabled || invalid) {
                  event.preventDefault();
                  return;
                }
                setDraggedId(screen.id);
                event.dataTransfer.setData('text/plain', screen.id);
                event.dataTransfer.effectAllowed = 'move';
              }}
              onDragEnd={() => setDraggedId(null)}
              onDragOver={(event) => {
                event.preventDefault();
                if (disabled || invalid) return;
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (disabled || invalid) {
                  setDraggedId(null);
                  return;
                }
                const source = event.dataTransfer.getData('text/plain');
                if (source) commitMove(source, index);
                setDraggedId(null);
              }}
              aria-posinset={index + 1}
              aria-setsize={screens.length}
            >
              <div className={styles.rowTop}>
                <span className={styles.grip} aria-hidden="true">
                  <GripVertical size={18} />
                </span>
                <span className={styles.icon} aria-hidden="true">
                  <StepIcon kind={screen.kind} role={screen.compositionRole} />
                </span>
                <span className={styles.titleBlock}>
                  <strong>{info.title}</strong>
                  <span className={styles.context}>{info.context}</span>
                </span>
                <StatusBadge size="sm" tone={required ? 'info' : 'neutral'}>
                  {required ? t('customer_step_required') : t('customer_step_optional')}
                </StatusBadge>
              </div>
              <div className={styles.controls}>
                <FormField label={t('customer_step_role')}>
                  <select
                    value={screen.compositionRole}
                    disabled={disabled || unknown}
                    onChange={(event) =>
                      onRoleChange(screen, event.target.value as Exclude<CustomerCompositionRole, 'Unknown'>)
                    }
                  >
                    {unknown && <option value="Unknown">{t('customer_role_unknown')}</option>}
                    {ROLE_OPTIONS[screen.kind].map((role) => (
                      <option
                        key={role}
                        value={role}
                        disabled={
                          role !== screen.compositionRole &&
                          !canChangeCustomerScreenRole(manifest, screen, role, sections)
                        }
                      >
                        {roleLabel(role, t)}
                      </option>
                    ))}
                  </select>
                </FormField>
                {screen.compositionRole === 'Dish' && (
                  <FormField label={t('customer_step_label')}>
                    <input
                      value={screen.presentationLabel ?? ''}
                      disabled={disabled}
                      onChange={(event) => onLabelChange(screen, event.target.value || null)}
                      maxLength={80}
                    />
                  </FormField>
                )}
                {isBundle && screen.kind === 'BundleSection' && (
                  <SectionParentField
                    screen={screen}
                    manifest={manifest}
                    sections={sections}
                    disabled={disabled}
                    t={t}
                    onChange={onSectionParentChange}
                  />
                )}
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  disabled={disabled || index === 0 || invalid || !canMoveUp}
                  onClick={() => move(index - 1)}
                  aria-label={t('customer_move_up')}
                  aria-describedby={dependencyBlocked ? dependencyHintId : undefined}
                >
                  <ArrowUp size={16} aria-hidden="true" />
                  <span>{t('customer_move_up')}</span>
                </button>
                <button
                  type="button"
                  disabled={disabled || index === screens.length - 1 || invalid || !canMoveDown}
                  onClick={() => move(index + 1)}
                  aria-label={t('customer_move_down')}
                  aria-describedby={dependencyBlocked ? dependencyHintId : undefined}
                >
                  <ArrowDown size={16} aria-hidden="true" />
                  <span>{t('customer_move_down')}</span>
                </button>
                <span
                  className={styles.position}
                  aria-label={t('customer_step_position', { current: index + 1, total: screens.length })}
                >
                  {t('customer_step_position', { current: index + 1, total: screens.length })}
                </span>
                {dependencyBlocked && (
                  <span id={dependencyHintId} className={styles.moveHint}>
                    {t('customer_order_dependency_blocked')}
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <span className={styles.live} aria-live="polite" aria-atomic="true">
        {announcement}
      </span>
    </div>
  );
}
