'use client';

import VisualTableLayout from '@/components/reservation/VisualTableLayout';
import GuestSelector from '@/components/reservation/GuestSelector';
import DateTimeSelector from '@/components/reservation/DateTimeSelector';
import CustomerDetailsForm from '@/components/reservation/CustomerDetailsForm';
import CapacityWarning from '@/components/reservation/CapacityWarning';
import SelectedTableInfo from '@/components/reservation/SelectedTableInfo';
import ReservationSuccessModal from '@/components/reservation/ReservationSuccessModal';
import { useReservationsPage } from '@/hooks/reservations/useReservationsPage';

type CssModule = Readonly<Record<string, string>>;

interface ReservationsPageLayoutProps {
  /**
   * Per-area CSS modules from the host template (the CartPageLayout pattern):
   * `page` styles this layout's own chrome; the rest are forwarded to the
   * reservation sub-components. Classic passes the components' existing
   * modules; craft passes its own re-skin modules. The guest-details form
   * (CustomerDetailsForm) deliberately keeps its own module — its inputs
   * inherit the template skin via the semantic token layer.
   */
  styles: {
    page: CssModule;
    floorPlan: CssModule;
    guests: CssModule;
    dateTime: CssModule;
    selectedTables: CssModule;
    capacity: CssModule;
  };
}

/**
 * The /reservations page orchestration shared by the classic and craft
 * templates — one `useReservationsPage` wiring, one DOM; the templates differ
 * only in the CSS modules they pass (ADR-006 reservations surface; relocated
 * from src/app/reservations/page.tsx).
 */
export default function ReservationsPageLayout({ styles }: Readonly<ReservationsPageLayoutProps>) {
  const {
    t,
    allTables,
    selectedTableIds,
    bookedTableIds,
    selectedTables,
    timeSlotOptions,
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
    <div className={styles.page.container}>
      <div className={styles.page.content}>
        <h1 className={styles.page.title}>{t('make_reservation', 'Make a Reservation')}</h1>

        <div className={styles.page.layout}>
          {/* Visual Table Layout */}
          <div className={styles.page.floorPlanSection}>
            <h2 className={styles.page.sectionTitle}>
              {t('select_your_tables', 'Select your Table(s)')}
              {selectedTableIds.length > 0 && (
                <span className={styles.page.selectionCount}>
                  ({t('tables_count_selected', '{{count}} selected', { count: selectedTableIds.length })})
                </span>
              )}
            </h2>

            {/* Capacity Warning */}
            {capacityWarning && <CapacityWarning numberOfGuests={numberOfGuests} styles={styles.capacity} />}

            <VisualTableLayout
              tables={allTables}
              selectedTableIds={selectedTableIds}
              onSelectTable={handleTableSelect}
              bookedTableIds={bookedTableIds}
              styles={styles.floorPlan}
            />
          </div>

          {/* Booking Panel */}
          <div className={styles.page.bookingPanel}>
            <h2 className={styles.page.panelTitle}>{t('book_your_table', 'Book your table')}</h2>

            <form onSubmit={handleSubmit} className={styles.page.bookingForm}>
              <GuestSelector
                numberOfGuests={numberOfGuests}
                onGuestsChange={setNumberOfGuests}
                styles={styles.guests}
              />

              <DateTimeSelector
                selectedDate={selectedDate}
                selectedTime={selectedTime}
                onDateChange={setSelectedDate}
                onTimeChange={setSelectedTime}
                loading={loading}
                timeSlotOptions={timeSlotOptions}
                styles={styles.dateTime}
              />

              <SelectedTableInfo
                selectedTables={selectedTables}
                requestCombineTables={requestCombineTables}
                onToggleCombine={() => setRequestCombineTables(!requestCombineTables)}
                styles={styles.selectedTables}
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
              <button type="submit" className={styles.page.bookButton} disabled={!canSubmit || submitting}>
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
