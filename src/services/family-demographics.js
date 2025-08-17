class FamilyDemographicsService {
  constructor(logger, database) {
    this.logger = logger;
    this.database = database;
  }

  async initializeFamilyFromEnvironment() {
    try {
      // Check if family members already exist
      const existingMembers = await this.database.getFamilyMembers();
      if (existingMembers.length > 0) {
        this.logger.info('Family members already exist in database');
        return;
      }

      // Initialize from environment variables if they exist
      const familyData = this.extractFamilyFromEnvironment();
      if (familyData.length === 0) {
        this.logger.info('No family data found in environment variables');
        return;
      }

      this.logger.info('Initializing family members from environment variables...');
      
      for (const member of familyData) {
        await this.database.addFamilyMember(member);
        this.logger.info(`Added family member: ${member.name} (${member.role})`);
      }

      this.logger.info(`Successfully initialized ${familyData.length} family members`);
    } catch (error) {
      this.logger.error('Error initializing family from environment:', error.message);
      throw error;
    }
  }

  extractFamilyFromEnvironment() {
    const familyMembers = [];

    // Add parents
    if (process.env.PARENT1_NAME && process.env.PARENT1_EMAIL) {
      familyMembers.push({
        name: process.env.PARENT1_NAME,
        email: process.env.PARENT1_EMAIL,
        role: 'parent',
        birthdate: '1990-01-01', // Default birthdate - should be updated manually
        emergencyContact: true
      });
    }

    if (process.env.PARENT2_NAME && process.env.PARENT2_EMAIL) {
      familyMembers.push({
        name: process.env.PARENT2_NAME,
        email: process.env.PARENT2_EMAIL,
        role: 'parent',
        birthdate: '1990-01-01', // Default birthdate - should be updated manually
        emergencyContact: true
      });
    }

    // Add children with calculated birthdates from current ages
    if (process.env.CHILD1_NAME && process.env.CHILD1_AGE) {
      const birthdate = this.calculateBirthdateFromAge(parseInt(process.env.CHILD1_AGE));
      familyMembers.push({
        name: process.env.CHILD1_NAME,
        role: 'child',
        birthdate: birthdate,
        emergencyContact: false
      });
    }

    if (process.env.CHILD2_NAME && process.env.CHILD2_AGE) {
      const birthdate = this.calculateBirthdateFromAge(parseInt(process.env.CHILD2_AGE));
      familyMembers.push({
        name: process.env.CHILD2_NAME,
        role: 'child',
        birthdate: birthdate,
        emergencyContact: false
      });
    }

    return familyMembers;
  }

  calculateBirthdateFromAge(currentAge) {
    const today = new Date();
    const birthYear = today.getFullYear() - currentAge;
    // Use January 1st as default birthday - this should be updated with actual birthdates
    return `${birthYear}-01-01`;
  }

  calculateAge(birthdate) {
    const birth = new Date(birthdate);
    const today = new Date();
    
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  }

  async getFamilyDemographics() {
    try {
      const familyMembers = await this.database.getFamilyMembers();
      
      const demographics = {
        parents: [],
        children: [],
        childAges: [],
        emergencyContacts: []
      };

      familyMembers.forEach(member => {
        const memberWithAge = {
          ...member,
          currentAge: this.calculateAge(member.birthdate)
        };

        if (member.role === 'parent') {
          demographics.parents.push(memberWithAge);
        } else if (member.role === 'child') {
          demographics.children.push(memberWithAge);
          demographics.childAges.push(memberWithAge.currentAge);
        }

        if (member.emergency_contact) {
          demographics.emergencyContacts.push(memberWithAge);
        }
      });

      // Calculate age range for children
      if (demographics.childAges.length > 0) {
        demographics.minChildAge = Math.min(...demographics.childAges);
        demographics.maxChildAge = Math.max(...demographics.childAges);
      } else {
        demographics.minChildAge = 0;
        demographics.maxChildAge = 18;
      }

      // Sort children by age (youngest first)
      demographics.children.sort((a, b) => a.currentAge - b.currentAge);

      this.logger.debug('Family demographics calculated:', {
        parents: demographics.parents.length,
        children: demographics.children.length,
        ageRange: `${demographics.minChildAge}-${demographics.maxChildAge}`
      });

      return demographics;
    } catch (error) {
      this.logger.error('Error getting family demographics:', error.message);
      throw error;
    }
  }

  async getChildrenInAgeRange(minAge, maxAge) {
    try {
      const children = await this.database.getFamilyMembersByRole('child');
      
      return children.filter(child => {
        const age = this.calculateAge(child.birthdate);
        return age >= minAge && age <= maxAge;
      }).map(child => ({
        ...child,
        currentAge: this.calculateAge(child.birthdate)
      }));
    } catch (error) {
      this.logger.error('Error getting children in age range:', error.message);
      throw error;
    }
  }

  async addChild(name, birthdate, additionalInfo = {}) {
    try {
      const childData = {
        name,
        birthdate,
        role: 'child',
        emergencyContact: false,
        ...additionalInfo
      };

      const id = await this.database.addFamilyMember(childData);
      this.logger.info(`Added child: ${name} (born ${birthdate})`);
      return id;
    } catch (error) {
      this.logger.error('Error adding child:', error.message);
      throw error;
    }
  }

  async addParent(name, email, birthdate, phone = null, isEmergencyContact = true) {
    try {
      const parentData = {
        name,
        email,
        phone,
        birthdate,
        role: 'parent',
        emergencyContact: isEmergencyContact
      };

      const id = await this.database.addFamilyMember(parentData);
      this.logger.info(`Added parent: ${name} (${email})`);
      return id;
    } catch (error) {
      this.logger.error('Error adding parent:', error.message);
      throw error;
    }
  }

  async updateMemberBirthdate(memberId, newBirthdate) {
    try {
      await this.database.updateFamilyMember(memberId, { birthdate: newBirthdate });
      this.logger.info(`Updated birthdate for member ID ${memberId} to ${newBirthdate}`);
    } catch (error) {
      this.logger.error('Error updating member birthdate:', error.message);
      throw error;
    }
  }

  async getEventRegistrationInfo() {
    try {
      const demographics = await this.getFamilyDemographics();
      
      const registrationInfo = {
        emergencyContact: null,
        parentNames: demographics.parents.map(p => p.name),
        parentEmails: demographics.parents.map(p => p.email).filter(Boolean),
        childrenInfo: demographics.children.map(child => ({
          name: child.name,
          age: child.currentAge
        }))
      };

      // Get primary emergency contact (first one found)
      if (demographics.emergencyContacts.length > 0) {
        const contact = demographics.emergencyContacts[0];
        registrationInfo.emergencyContact = {
          name: contact.name,
          phone: contact.phone || process.env.EMERGENCY_CONTACT,
          email: contact.email
        };
      }

      return registrationInfo;
    } catch (error) {
      this.logger.error('Error getting registration info:', error.message);
      throw error;
    }
  }

  isEventAgeAppropriate(event, demographics = null) {
    if (!demographics) {
      // This will be resolved by the caller - should not be async here
      throw new Error('Demographics required for age checking');
    }

    if (!event.ageRange || (!event.ageRange.min && !event.ageRange.max)) {
      return true; // No age restrictions
    }

    const eventMinAge = event.ageRange.min || 0;
    const eventMaxAge = event.ageRange.max || 18;

    // Check if any child fits in the event age range
    return demographics.children.some(child => {
      return child.currentAge >= eventMinAge && child.currentAge <= eventMaxAge;
    });
  }
}

module.exports = FamilyDemographicsService;