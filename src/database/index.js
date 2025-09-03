const PostgresDatabase = require('./postgres');

class Database {
  constructor() {
    // Always use PostgreSQL for both local and production
    this.postgres = new PostgresDatabase();
  }

  async init() {
    return await this.postgres.init();
  }

  // Delegate all methods to PostgreSQL implementation
  async saveEvent(event) {
    return await this.postgres.saveEvent(event);
  }

  async saveEventScore(eventId, scores) {
    return await this.postgres.saveEventScore(eventId, scores);
  }

  async saveSMSApproval(eventId, phoneNumber, message) {
    return await this.postgres.saveSMSApproval(eventId, phoneNumber, message);
  }

  async updateSMSApproval(approvalId, response, status) {
    return await this.postgres.updateSMSApproval(approvalId, response, status);
  }

  async saveRegistration(eventId, success, confirmationNumber, errorMessage, screenshotPath, paymentInfo) {
    return await this.postgres.saveRegistration(eventId, success, confirmationNumber, errorMessage, screenshotPath, paymentInfo);
  }

  async getEventsByStatus(status) {
    return await this.postgres.getEventsByStatus(status);
  }

  async getEventById(id) {
    return await this.postgres.getEventById(id);
  }

  async getEventsInDateRange(startDate, endDate) {
    return await this.postgres.getEventsInDateRange(startDate, endDate);
  }

  async updateEventStatus(eventId, status) {
    return await this.postgres.updateEventStatus(eventId, status);
  }

  async getTopScoredEvents(limit = 10) {
    return await this.postgres.getTopScoredEvents(limit);
  }

  async getApprovalsByStatus(status) {
    return await this.postgres.getApprovalsByStatus(status);
  }

  async getRegistrationHistory(eventId) {
    return await this.postgres.getRegistrationHistory(eventId);
  }

  async getRegistrationStats(timeframe = '24 hours') {
    return await this.postgres.getRegistrationStats(timeframe);
  }

  async trackVenueVisit(venueName, address) {
    return await this.postgres.trackVenueVisit(venueName, address);
  }

  async hasVisitedVenue(venueName) {
    return await this.postgres.hasVisitedVenue(venueName);
  }

  async getVenueVisitCount(venueName) {
    return await this.postgres.getVenueVisitCount(venueName);
  }

  async cleanupOldEvents(daysToKeep = 90) {
    return await this.postgres.cleanupOldEvents(daysToKeep);
  }

  async getEventStats() {
    return await this.postgres.getEventStats();
  }

  async saveFamilyMember(member) {
    return await this.postgres.saveFamilyMember(member);
  }

  async addFamilyMember(member) {
    return await this.postgres.addFamilyMember(member);
  }

  async getFamilyMembers(activeOnly = true) {
    return await this.postgres.getFamilyMembers(activeOnly);
  }

  async getFamilyMemberById(id) {
    return await this.postgres.getFamilyMemberById(id);
  }

  async getFamilyMembersByRole(role, activeOnly = true) {
    return await this.postgres.getFamilyMembersByRole(role, activeOnly);
  }

  async updateFamilyMember(id, updates) {
    return await this.postgres.updateFamilyMember(id, updates);
  }

  async recordEventMerge(primaryEventId, mergedEvent, similarityScore, mergeType) {
    return await this.postgres.recordEventMerge(primaryEventId, mergedEvent, similarityScore, mergeType);
  }

  async getEventMergeHistory(eventId, limit = 10) {
    return await this.postgres.getEventMergeHistory(eventId, limit);
  }

  async getEventInteractions(limit = 1000) {
    return await this.postgres.getEventInteractions(limit);
  }

  async cacheWeatherData(location, date, weatherData) {
    return await this.postgres.cacheWeatherData(location, date, weatherData);
  }

  async getCachedWeatherData(location, date) {
    return await this.postgres.getCachedWeatherData(location, date);
  }

  async isVenueVisited(venueName) {
    return await this.postgres.isVenueVisited(venueName);
  }

  async query(sql, params = []) {
    return await this.postgres.query(sql, params);
  }

  async close() {
    return await this.postgres.close();
  }
}

module.exports = Database;