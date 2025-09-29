class FamilyDemographicsService {
  constructor(logger, database) {
    this.logger = logger;
    this.database = database;
  }

  async initializeFamilyFromEnvironment() {
    try {
      this.logger.info('Initializing family demographics from environment/database...');

      // Check if we already have family data in the database
      const existingDemographics = await this.getFamilyDemographics();

      if (existingDemographics.children.length > 0 || existingDemographics.parents.length > 0) {
        this.logger.info(`Family demographics already exist: ${existingDemographics.children.length} children, ${existingDemographics.parents.length} parents`);
        return existingDemographics;
      }

      this.logger.info('No existing family data found in database');
      return existingDemographics;

    } catch (error) {
      this.logger.warn('Error initializing family demographics:', error.message);
      // Return minimal demographics if initialization fails
      return {
        parents: [],
        children: [],
        childAges: [],
        emergencyContacts: [],
        minChildAge: 2,
        maxChildAge: 4
      };
    }
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
      // Try new children table first
      const childrenResult = await this.database.query(`
        SELECT name, birth_date, interests, special_needs
        FROM children
        WHERE active = true
        ORDER BY birth_date ASC
      `);

      // Try family_contacts for parents
      const parentsResult = await this.database.query(`
        SELECT name, email, phone
        FROM family_contacts
        WHERE contact_type = 'parent'
        ORDER BY is_primary DESC
      `);

      // Try family_contacts for emergency contacts
      const emergencyResult = await this.database.query(`
        SELECT name, email, phone
        FROM family_contacts
        WHERE contact_type = 'emergency'
      `);

      // Calculate demographics from new tables
      const children = childrenResult.rows.map(child => {
        const birthDate = new Date(child.birth_date);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }

        return {
          name: child.name,
          birthDate: child.birth_date,
          currentAge: age,
          interests: child.interests || [],
          specialNeeds: child.special_needs || ''
        };
      });

      const parents = parentsResult.rows.map(parent => ({
        name: parent.name,
        email: parent.email,
        phone: parent.phone
      }));

      const emergencyContacts = emergencyResult.rows.map(contact => ({
        name: contact.name,
        email: contact.email,
        phone: contact.phone
      }));

      const demographics = {
        parents,
        children,
        childAges: children.map(child => child.currentAge),
        emergencyContacts,
        minChildAge: children.length > 0 ? Math.min(...children.map(c => c.currentAge)) : 0,
        maxChildAge: children.length > 0 ? Math.max(...children.map(c => c.currentAge)) : 18
      };

      this.logger.debug('Family demographics calculated from database:', {
        parents: demographics.parents.length,
        children: demographics.children.length,
        ageRange: `${demographics.minChildAge}-${demographics.maxChildAge}`
      });

      return demographics;

    } catch (error) {
      this.logger.warn('Failed to load demographics from new tables, trying family_members fallback:', error.message);
      
      try {
        // Fallback to original family_members table
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

        this.logger.debug('Family demographics calculated from family_members fallback:', {
          parents: demographics.parents.length,
          children: demographics.children.length,
          ageRange: `${demographics.minChildAge}-${demographics.maxChildAge}`
        });

        return demographics;

      } catch (fallbackError) {
        this.logger.error('Error getting family demographics from fallback:', fallbackError.message);
        throw new Error('Family demographics unavailable - database contains no family information');
      }
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
          phone: contact.phone,
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