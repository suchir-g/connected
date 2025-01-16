import React from 'react';
import styles from './Loading.module.css';

const Loading = () => {
  return (
    <div className={styles.loadingContainer}>
      <div className={`${styles.disc} ${styles.red}`}></div>
      <div className={`${styles.disc} ${styles.yellow}`}></div>
      <div className={`${styles.disc} ${styles.red}`}></div>
      <div className={`${styles.disc} ${styles.yellow}`}></div>
    </div>
  );
};

export default Loading;