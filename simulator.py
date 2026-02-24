import pandas as pd
import numpy as np
import datetime
import os

# Set random seed for reproducibility
np.random.seed(42)

def generate_sensor_data(num_samples=5000):
    print("Generating simulated sensor data...")
    timestamps = [datetime.datetime.now() - datetime.timedelta(minutes=i) for i in range(num_samples)]
    timestamps.reverse()
    
    # Simulate basic features
    # Normal flow ~ 50 L/min, abnormal drop ~ 20 L/min or spike
    # Normal pressure ~ 60 PSI, abnormal drop ~ 30 PSI
    # Normal acoustic ~ 10 dB, abnormal spike ~ 60 dB
    
    data = []
    nodes = ['Node-A', 'Node-B', 'Node-C', 'Node-D', 'Node-E']
    
    for i in range(num_samples):
        node = np.random.choice(nodes)
        
        # 85% normal, 15% anomaly
        is_anomaly = np.random.rand() > 0.85
        
        if not is_anomaly:
            flow_rate = np.random.normal(50, 5)
            pressure = np.random.normal(60, 4)
            acoustic = np.random.normal(10, 2)
            label = 0
            severity = 0
        else:
            # Type of anomaly: 0=Leak, 1=Burst pipe
            anomaly_type = np.random.choice([0, 1])
            if anomaly_type == 0: # Leak
                flow_rate = np.random.normal(35, 5)
                pressure = np.random.normal(45, 5)
                acoustic = np.random.normal(30, 5)
                severity = np.random.randint(3, 7)
            else: # Burst
                flow_rate = np.random.normal(10, 5)
                pressure = np.random.normal(20, 5)
                acoustic = np.random.normal(70, 10)
                severity = np.random.randint(7, 11)
                
            label = 1
            
        data.append([
            timestamps[i].strftime('%Y-%m-%d %H:%M:%S'),
            node,
            round(flow_rate, 2),
            round(pressure, 2),
            round(acoustic, 2),
            severity,
            label
        ])
        
    df = pd.DataFrame(data, columns=['timestamp', 'node_id', 'flow_rate', 'pressure', 'acoustic_signal_strength', 'anomaly_severity', 'label'])
    
    filepath = 'sensor_data.csv'
    df.to_csv(filepath, index=False)
    print(f"Data generation complete. Saved to {filepath}.")
    return filepath

if __name__ == '__main__':
    generate_sensor_data()
