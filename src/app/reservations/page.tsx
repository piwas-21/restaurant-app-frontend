'use client';

import VisualTableLayout from '@/components/reservation/VisualTableLayout';
import GuestSelector from '@/components/reservation/GuestSelector';
import DateTimeSelector from '@/components/reservation/DateTimeSelector';
import CustomerDetailsForm from '@/components/reservation/CustomerDetailsForm';
import CapacityWarning from '@/components/reservation/CapacityWarning';
import SelectedTableInfo from '@/components/reservation/SelectedTableInfo';
import ReservationSuccessModal from '@/components/reservation/ReservationSuccessModal';
import { useReservationsPage } from '@/hooks/reservations/useReservationsPage';
import styles from './ReservationsPage.module.css';

export default function ReservationsPage() {
  const {
    t,
    allTables,
    selectedTableIds,
    bookedTableIds,
    selectedTables,
    filteredTimeSlots,
    capacityWarning,
    handleTableSelect,
    selectedDate,
    setSelectedDate,
    selectedTime,
    setSelectedTime,
    numberOfGuests,
    setNumberOfGuests,
    loading,
    customerName,
    setCustomerName,
    customerEmail,
    setCustomerEmail,
    customerPhone,
    setCustomerPhone,
    specialRequests,
    setSpecialRequests,
    requestCombineTables,
    setRequestCombineTables,
    submitting,
    canSubmit,
    handleSubmit,
    showSuccessModal,
    handleCloseSuccessModal,
  } = useReservationsPage();

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h1 className={styles.title}>{t('make_reservation', 'Make a Reservation')}</h1>

        <div className={styles.layout}>
          {/* Visual Table Layout */}
          <div className={styles.floorPlanSection}>
            <h2 className={styles.sectionTitle}>
              {t('select_your_tables', 'Select your Table(s)')}
              {selectedTableIds.length > 0 && (
                <span className={styles.selectionCount}>
                  ({t('tables_count_selected', '{{count}} selected', { count: selectedTableIds.length })})
                </span>
              )}
            </h2>

            {/* Capacity Warning */}
            {capacityWarning && <CapacityWarning numberOfGuests={numberOfGuests} />}

            <VisualTableLayout
              tables={allTables}
              selectedTableIds={selectedTableIds}
              onSelectTable={handleTableSelect}
              bookedTableIds={bookedTableIds}
            />
          </div>

          {/* Booking Panel */}
          <div className={styles.bookingPanel}>
            <h2 className={styles.panelTitle}>{t('book_your_table', 'Book your table')}</h2>

            <form onSubmit={handleSubmit} className={styles.bookingForm}>
              <GuestSelector numberOfGuests={numberOfGuests} onGuestsChange={setNumberOfGuests} />

              <DateTimeSelector
                selectedDate={selectedDate}
                selectedTime={selectedTime}
                onDateChange={setSelectedDate}
                onTimeChange={setSelectedTime}
                loading={loading}
                availableTimeSlots={filteredTimeSlots}
              />

              <SelectedTableInfo
                selectedTables={selectedTables}
                requestCombineTables={requestCombineTables}
                onToggleCombine={() => setRequestCombineTables(!requestCombineTables)}
              />

              <CustomerDetailsForm
                customerName={customerName}
                customerEmail={customerEmail}
                customerPhone={customerPhone}
                specialRequests={specialRequests}
                onNameChange={setCustomerName}
                onEmailChange={setCustomerEmail}
                onPhoneChange={setCustomerPhone}
                onSpecialRequestsChange={setSpecialRequests}
              />

              {/* Submit Button */}
              <button type="submit" className={styles.bookButton} disabled={!canSubmit || submitting}>
                {submitting ? t('booking', 'Booking...') : t('book_now', 'Book Now')}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Success Modal */}
      <ReservationSuccessModal
        isOpen={showSuccessModal}
        onClose={handleCloseSuccessModal}
        customerEmail={customerEmail}
        numberOfTables={selectedTableIds.length}
      />
    </div>
  );
}
