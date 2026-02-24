import pandas as pd
import numpy as np
import pickle
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, accuracy_score

def train_rf_model(csv_path='sensor_data.csv', model_path='rf_model.pkl'):
    print(f"Loading data from {csv_path}...")
    try:
        df = pd.read_csv(csv_path)
    except FileNotFoundError:
        print("Dataset not found. Please run simulator.py first.")
        return
    
    # Features and labels
    # We drop timestamp, node_id, anomaly_severity, and label for features
    X = df[['flow_rate', 'pressure', 'acoustic_signal_strength']]
    y = df['label']
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print("Training Random Forest Classifier...")
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    
    # Evaluate
    y_pred = model.predict(X_test)
    acc = accuracy_score(y_test, y_pred)
    print(f"Model Accuracy: {acc:.4f}")
    print("Classification Report:\n", classification_report(y_test, y_pred))
    
    # Save the model
    with open(model_path, 'wb') as f:
        pickle.dump(model, f)
        
    print(f"Model successfully saved to {model_path}.")

if __name__ == '__main__':
    train_rf_model()
