-- The test database lives next to the development one so integration and E2E
-- tests never touch data created through the UI (research R-11).
CREATE DATABASE IF NOT EXISTS hotel_test;
GRANT ALL PRIVILEGES ON hotel.* TO 'hotel'@'%';
GRANT ALL PRIVILEGES ON hotel_test.* TO 'hotel'@'%';
FLUSH PRIVILEGES;
