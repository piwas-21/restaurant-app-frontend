"use client";

import React from "react";
import styles from "@/app/styles/MenuPage.module.css";

type Props = {
  onAdd: () => void;
  onFeedback: () => void;
  addLabel: string;
  addAria: string;
  feedbackLabel: string;
  feedbackAria: string;
};

export default function MenuItemActions({ onAdd, onFeedback, addLabel, addAria, feedbackLabel, feedbackAria }: Props) {
  return (
    <div className={styles.itemActions}>
      <button className={styles.addToOrderButton} onClick={onAdd} aria-label={addAria}>
        {addLabel}
      </button>
      {/* feedback feature will be implemented in the next release */}
      {/* <button className={styles.feedbackButton} onClick={onFeedback} aria-label={feedbackAria}>
        {feedbackLabel}
      </button> */}
    </div>
  );
}

