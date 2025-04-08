// src/app/constants/domains.ts
export const domains = [
    {
      id: 1,
      name: "Housing & Basic Needs",
      questions: [
        {
          id: 1,
          text: "What is your current housing situation?",
          flag: "Housing instability / temporary housing",
          sampleResponse: "I live with friends, but it's temporary."
        },
        {
          id: 2,
          text: "Are you worried about losing your housing in the near future?",
          flag: "Housing insecurity",
          sampleResponse: "Yes, definitely."
        },
        {
          id: 3,
          text: "Have any utility companies threatened to shut off your services?",
          flag: "Utilities support needed",
          sampleResponse: "Yes, twice last winter."
        },
        {
          id: 4,
          text: "Any trouble getting to medical appointments or work due to transportation?",
          flag: "Transportation barrier",
          sampleResponse: "Yes, I missed two appointments last month."
        },
        {
          id: 5,
          text: "Do you feel safe where you live?",
          flag: "Home safety concern",
          sampleResponse: "Not really, there's been break-ins nearby."
        },
        {
          id: 6,
          text: "Any concerns about your neighborhood's safety?",
          flag: "Neighborhood safety concern",
          sampleResponse: "Yes, it is not well lit and I dont feel comfortable walking at night."
        }
      ]
    },
    {
      id: 2,
      name: "Personal Safety & Demographics",
      questions: [
        {
          id: 1,
          text: "What race or ethnicity do you identify with?",
          flag: "Demographics",
          sampleResponse: "Black and Native American."
        },
        {
          id: 2,
          text: "Are you Hispanic or Latino?",
          flag: "Demographics",
          sampleResponse: "No."
        },
        {
          id: 3,
          text: "Have you been hurt or threatened by someone in the past year?",
          flag: "Interpersonal violence",
          sampleResponse: "Yes, by a former partner."
        },
        {
          id: 4,
          text: "Have you felt afraid of your current or past partner?",
          flag: "Urgent safety referral",
          sampleResponse: "Yes."
        },
        {
          id: 5,
          text: "Has anyone taken money from you or withheld it unfairly?",
          flag: "Financial abuse",
          sampleResponse: "Yes, my brother borrowed money and never paid me back."
        }
      ]
    },
    {
      id: 3,
      name: "Education & Employment",
      questions: [
        {
          id: 1,
          text: "What is the highest level of education you've completed?",
          flag: "Education status",
          sampleResponse: "Some high school."
        },
        {
          id: 2,
          text: "What is your current work status?",
          flag: "Employment support needed",
          sampleResponse: "Unemployed."
        },
        {
          id: 3,
          text: "Is it hard to afford basic needs?",
          flag: "Financial strain",
          sampleResponse: "Yes, very hard."
        },
        {
          id: 4,
          text: "Would you like help finding a job?",
          flag: "Referral to workforce navigator",
          sampleResponse: "Yes."
        },
        {
          id: 5,
          text: "Interested in help with school or job training?",
          flag: "Education support",
          sampleResponse: "Yes, I'd love that."
        },
        {
          id: 6,
          text: "Do you need better daycare?",
          flag: "Childcare need",
          sampleResponse: "Yes, my childcare falls through often."
        }
      ]
    },
    {
      id: 4,
      name: "Food & Physical Activity",
      questions: [
        {
          id: 1,
          text: "Have you worried about running out of food?",
          flag: "Food insecurity",
          sampleResponse: "Yes, often."
        },
        {
          id: 2,
          text: "Did the food you bought ever not last?",
          flag: "Food insecurity",
          sampleResponse: "Yes."
        },
        {
          id: 3,
          text: "Can you get enough healthy food?",
          flag: "Healthy food access",
          sampleResponse: "Not really, healthy food is expensive."
        },
        {
          id: 4,
          text: "How often do you exercise per week?",
          flag: "Physical activity support",
          sampleResponse: "One or two days."
        }
      ]
    },
    {
      id: 5,
      name: "Environmental Factors",
      questions: [
        {
          id: 1,
          text: "Do you have any issues in your home—like mold, pests, or no heat?",
          flag: "Environmental hazard, refer to housing services",
          sampleResponse: "Yes, mold and broken heater."
        }
      ]
    },
    {
      id: 6,
      name: "Language & Communication",
      questions: [
        {
          id: 1,
          text: "What language are you most comfortable speaking?",
          flag: "Language preference",
          sampleResponse: "Spanish."
        },
        {
          id: 2,
          text: "Do you often need help reading medical materials?",
          flag: "Health literacy / translation support",
          sampleResponse: "Sometimes, especially forms."
        }
      ]
    }
  ];