'use client';

import React from 'react';
import styles from './MenuEditor.module.css';
import { MenuSection } from '@/types/menu';
import MenuItemSelector from './MenuItemSelector';
import { useTranslation } from 'react-i18next';
import ConfirmationModal from '@/components/common/ConfirmationModal';
import { useMenuSectionDraft, MenuSectionCommitMode } from '@/hooks/admin/useMenuSectionDraft';

interface MenuSectionEditorProps {
  sections: MenuSection[];
  onChange: (sections: MenuSection[]) => void;
  /**
   * Defaults to `explicit` — the modals' behaviour, byte-identical. The unified
   * editor page passes `live` so its single page-level Save is the only commit
   * point (owner call, slice 7 PR2c). Goes away with the modals in PR2d.
   */
  commitMode?: MenuSectionCommitMode;
}

const MenuSectionEditor: React.FC<MenuSectionEditorProps> = ({ sections, onChange, commitMode = 'explicit' }) => {
  const { t } = useTranslation();
  const {
    localSections,
    hasChanges,
    expandedSections,
    sectionToDelete,
    draggedIndex,
    toggleSection,
    addSection,
    updateSection,
    updateSectionItems,
    confirmRemoveSection,
    cancelRemoveSection,
    handleRemoveSection,
    moveSection,
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    commit,
    reset,
  } = useMenuSectionDraft({ sections, onChange, commitMode });

  return (
    <div className={styles.scheduleEditor}>
      <div className={styles.sectionHeader}>
        <h3 className={styles.sectionTitle}>{t('menu_sections')}</h3>
        <button type="button" onClick={addSection} className={styles.addButton}>
          + {t('add_section')}
        </button>
      </div>

      {localSections.length === 0 ? (
        <div className={styles.emptyState}>
          <p>{t('no_sections_yet')}</p>
          <p className={styles.helpText}>{t('sections_help')}</p>
        </div>
      ) : (
        <div className={styles.sectionList}>
          {localSections.map((section, index) => (
            <div
              key={section.id}
              className={styles.sectionCard}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              style={{ opacity: draggedIndex === index ? 0.5 : 1 }}
            >
              <div className={styles.sectionHeader}>
                <div className={styles.sectionHeaderLeft}>
                  <span className={styles.dragHandle}>⋮⋮</span>
                  <h4 className={styles.sectionName}>{section.name || `${t('section')} ${index + 1}`}</h4>
                </div>
                <div className={styles.sectionActions}>
                  <button
                    type="button"
                    onClick={() => moveSection(index, 'up')}
                    disabled={index === 0}
                    className={styles.iconButton}
                    title={t('move_up')}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => moveSection(index, 'down')}
                    disabled={index === localSections.length - 1}
                    className={styles.iconButton}
                    title={t('move_down')}
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleSection(section.id)}
                    className={styles.iconButton}
                    title={expandedSections.has(section.id) ? t('collapse') : t('expand')}
                  >
                    {expandedSections.has(section.id) ? '−' : '+'}
                  </button>
                  <button
                    type="button"
                    onClick={() => confirmRemoveSection(index)}
                    className={`${styles.iconButton} ${styles.danger}`}
                    title={t('delete_section')}
                  >
                    ×
                  </button>
                </div>
              </div>

              {expandedSections.has(section.id) && (
                <div className={styles.sectionForm}>
                  {/* Section Name */}
                  <div className={styles.formGroup}>
                    <label>{t('section_name')} *</label>
                    <input
                      type="text"
                      value={section.name}
                      onChange={(e) => updateSection(index, { name: e.target.value })}
                      placeholder={t('section_name_placeholder')}
                      className={styles.input}
                    />
                  </div>

                  {/* Section Description */}
                  <div className={styles.formGroup}>
                    <label>{t('description')}</label>
                    <textarea
                      value={section.description || ''}
                      onChange={(e) => updateSection(index, { description: e.target.value })}
                      placeholder={t('description_placeholder')}
                      className={`${styles.input} ${styles.textarea}`}
                    />
                  </div>

                  {/* Required Toggle as Chip */}
                  <div className={styles.formRow}>
                    <div className={styles.chipGroup}>
                      <div className={styles.chip}>
                        <input
                          type="checkbox"
                          id={`required-${section.id}`}
                          checked={section.isRequired}
                          onChange={(e) => updateSection(index, { isRequired: e.target.checked })}
                        />
                        <label htmlFor={`required-${section.id}`}>{t('required_section')}</label>
                      </div>
                    </div>
                  </div>

                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label>{t('minimum_selection')}</label>
                      <input
                        type="number"
                        min="0"
                        value={section.minSelection}
                        onChange={(e) =>
                          updateSection(index, {
                            minSelection: parseInt(e.target.value) || 0,
                          })
                        }
                        className={`${styles.input} ${styles.numberInput}`}
                      />
                    </div>

                    <div className={styles.formGroup}>
                      <label>{t('maximum_selection')}</label>
                      <input
                        type="number"
                        min="1"
                        value={section.maxSelection}
                        onChange={(e) =>
                          updateSection(index, {
                            maxSelection: parseInt(e.target.value) || 1,
                          })
                        }
                        className={`${styles.input} ${styles.numberInput}`}
                      />
                    </div>
                  </div>

                  {/* Menu Items */}
                  <MenuItemSelector
                    items={section.items}
                    maxSelection={section.maxSelection}
                    onChange={(items) => updateSectionItems(index, items)}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Save/Cancel Buttons */}
      {hasChanges && (
        <div className={styles.editorActions}>
          <button type="button" onClick={reset} className={styles.cancelButton}>
            {t('cancel')}
          </button>
          <button type="button" onClick={commit} className={styles.saveButton}>
            {t('save')}
          </button>
        </div>
      )}

      <ConfirmationModal
        isOpen={sectionToDelete !== null}
        onClose={cancelRemoveSection}
        onConfirm={handleRemoveSection}
        message={t('confirm_delete_section', 'Are you sure you want to delete this section?')}
      />
    </div>
  );
};

export default MenuSectionEditor;
