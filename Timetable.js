import React, { useState, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useFocusEffect } from '@react-navigation/native';
import { GestureDetector, Gesture, Directions, GestureHandlerRootView } from 'react-native-gesture-handler';
import ical from 'ical.js';
import { format, parseISO, startOfDay, isToday, addDays } from 'date-fns';
import Icon from 'react-native-vector-icons/MaterialIcons';

export default function TimetableScreen() {
  const [savedCalendarLink, setSavedCalendarLink] = useState('');
  const [events, setEvents] = useState([]);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [groupedEvents, setGroupedEvents] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [nextEvent, setNextEvent] = useState(null);

  // Calculate next event whenever events or time changes
  useFocusEffect(
    useCallback(() => {
      const calculateNextEvent = () => {
        const now = new Date();
        const upcoming = events.filter(e => e.end > now);
        upcoming.sort((a, b) => a.start - b.start);
        setNextEvent(upcoming[0] || null);
      };
      
      calculateNextEvent();
      const interval = setInterval(calculateNextEvent, 60000); // Update every minute
      return () => clearInterval(interval);
    }, [events])
  );

  // Fetch and parse iCal data
  const fetchCalendarData = async (url) => {
    try {
      const response = await fetch(url);
      const text = await response.text();
      const jcalData = ical.parse(text);
      const comp = new ical.Component(jcalData);
      const vevents = comp.getAllSubcomponents('vevent');
      
      const parsedEvents = vevents.map(event => {
        const icalEvent = new ical.Event(event);
        const description = icalEvent.description
        return {
          start: parseISO(icalEvent.startDate.toJSDate().toISOString()),
          end: parseISO(icalEvent.endDate.toJSDate().toISOString()),
          summary: icalEvent.summary,
          location: icalEvent.location,
          description: icalEvent.description,
          id: icalEvent.uid,
          courseCode: description.split("\n")[0].split(",")[0].split("-")[0],
          courseName: description.split("\n")[1]
        };
      });
      
      // Group events by date
      const grouped = parsedEvents.reduce((acc, event) => {
        const dateKey = startOfDay(event.start).toISOString();
        acc[dateKey] = [...(acc[dateKey] || []), event];
        return acc;
      }, {});
      
      setGroupedEvents(grouped);
      setEvents(parsedEvents);
      return parsedEvents; // Return parsed events for immediate processing
    } catch (error) {
      console.error('Error fetching calendar:', error);
      return [];
    }
  };

  // Find closest date with events (using groupedEvents state)
  const findClosestDate = (date, direction = 1) => {
    let current = new Date(date);
    for (let i = 0; i < 365; i++) {
      current = addDays(current, direction);
      const dateKey = startOfDay(current).toISOString();
      if (groupedEvents[dateKey]) return current;
    }
    return date;
  };

  // Handle swipe navigation
  const swipeLeft = Gesture.Fling()
    .direction(Directions.LEFT)
    .onEnd(() => {
      setCurrentDate(prev => findClosestDate(prev, 1));
    });

  const swipeRight = Gesture.Fling()
    .direction(Directions.RIGHT)
    .onEnd(() => {
      setCurrentDate(prev => findClosestDate(prev, -1));
    });

    // Navigation arrows logic
    const canNavigatePrev = useMemo(() => {
      const prevDate = findClosestDate(currentDate, -1);
      return prevDate.getTime() !== currentDate.getTime();
    }, [currentDate, groupedEvents]);
  
    const canNavigateNext = useMemo(() => {
      const nextDate = findClosestDate(currentDate, 1);
      return nextDate.getTime() !== currentDate.getTime();
    }, [currentDate, groupedEvents]);

  useFocusEffect(
    useCallback(() => {
      const loadData = async () => {
        const link = await AsyncStorage.getItem('storedCalendarLink');
        if (link) {
          setSavedCalendarLink(link);
          const parsedEvents = await fetchCalendarData(link);

          const now = new Date();
          
          // Get all unique dates from events
          const allDates = parsedEvents.map(event => startOfDay(event.start).getTime());
          const uniqueDates = [...new Set(allDates)]
            .map(t => new Date(t))
            .sort((a, b) => a - b);

          // Filter events that haven't ended yet
          const upcomingEvents = parsedEvents.filter(event => event.end > now);
          if (upcomingEvents.length > 0) {
            upcomingEvents.sort((a, b) => a.start - b.start);
            const nextEvent = upcomingEvents[0];
            setCurrentDate(startOfDay(nextEvent.start));
          } else {
            // No upcoming events, find the next date with any events
            const todayStart = startOfDay(now);
            const futureDates = uniqueDates.filter(date => date >= todayStart);
            if (futureDates.length > 0) {
              setCurrentDate(futureDates[0]);
            } else {
              // Fallback to the latest past date or today
              setCurrentDate(uniqueDates.length > 0 ? uniqueDates[uniqueDates.length - 1] : now);
            }
          }
        }
      };
      loadData();
    }, [])
  );

  const toggleExpand = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (!savedCalendarLink) {
    return (
      <View style={styles.container}>
        <Text>You haven't set a link to your timetable yet!</Text>
      </View>
    );
  }

  const dateKey = startOfDay(currentDate).toISOString();
  const dailyEvents = groupedEvents[dateKey] || [];

  return (
    <GestureHandlerRootView>
      <GestureDetector gesture={Gesture.Race(swipeLeft, swipeRight)}>
        <View style={{flex: 1, padding: 16, paddingTop: 75}}>
          <View style={styles.header}>
            <TouchableOpacity 
              onPress={() => setCurrentDate(findClosestDate(currentDate, -1))}
              disabled={!canNavigatePrev}
            >
              <Icon 
                name="arrow-back" 
                size={24} 
                color={canNavigatePrev ? '#000' : '#ccc'} 
              />
            </TouchableOpacity>

            <Text style={styles.dateText}>
              {format(currentDate, 'EEEE, do MMMM')}
            </Text>

            <TouchableOpacity 
              onPress={() => setCurrentDate(findClosestDate(currentDate, 1))}
              disabled={!canNavigateNext}
            >
              <Icon 
                name="arrow-forward" 
                size={24} 
                color={canNavigateNext ? '#000' : '#ccc'} 
              />
            </TouchableOpacity>
          </View>

          {dailyEvents.sort((a, b) => a.start - b.start).map((event, index) => {
            const isNext = nextEvent?.id === event.id;
            return (
              <TouchableOpacity 
                key={event.id || index} 
                onPress={() => toggleExpand(event.id)}
              >
                <View style={[
                  styles.eventContainer,
                  isNext && styles.nextEventContainer
                ]}>
                  <Text style={[
                    styles.timeText,
                    isNext && styles.nextEventText
                  ]}>
                    {format(event.start, 'HH:mm')} - {format(event.end, 'HH:mm')}
                  </Text>
                  <Text style={[
                    styles.eventTitle,
                    isNext && styles.nextEventText
                  ]}>
                    {event.summary}
                  </Text>
                  <Text style={styles.locationText}>{event.courseCode} | {event.location}</Text>
                  
                  {expandedId === event.id && (
                    <View style={styles.expandedContent}>
                      <Text>{event.description}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            )}
          )}
        </View>
      </GestureDetector>
    </GestureHandlerRootView>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 20,
    alignItems: 'center',
  },
  dateText: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  eventContainer: {
    backgroundColor: '#f0f0f0',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  timeText: {
    fontSize: 16,
    color: '#666',
  },
  eventTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 5,
  },
  locationText: {
    fontSize: 14,
    color: '#888',
    marginTop: 5,
  },
  expandedContent: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#ddd',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  nextEventContainer: {
    backgroundColor: '#e3f2fd',
    borderLeftWidth: 4,
    borderLeftColor: '#2196f3',
  },
  nextEventText: {
    color: '#1976d2',
  },
});