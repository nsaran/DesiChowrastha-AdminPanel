import React, { useEffect, useState } from 'react';
import { Layout, Form, Input, Button, Upload, message, Image } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { useParams } from 'react-router-dom';
import { firestore, storage } from '../../../config/firebase';

const { Header, Footer, Content } = Layout;

const FillerComponent = () => {
    const [form] = Form.useForm();
    const { restaurantId } = useParams();
    const [fileList, setFileList] = useState([]);
    const [imageUrl, setImageUrl] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            const doc = await firestore.collection('restaurants').doc(restaurantId).collection('filler').doc('imageData').get();
            if (doc.exists) {
                setImageUrl(doc.data().imageUrl);
            }
        };
        fetchData();
    }, [restaurantId]);

    const onFileChange = info => {
        let newFileList = [...info.fileList];
        newFileList = newFileList.slice(-1);
        setFileList(newFileList);
    };

    const onRemove = file => {
        setFileList([]);
        setImageUrl('');
    };

    const handleUrlSubmit = async (values) => {
        try {
            await firestore.collection('restaurants').doc(restaurantId).collection('filler').doc('imageData').set({
                imageTitle: values.imageTitle,
                imageUrl: values.imageUrl,
                timestamp: new Date()
            }, { merge: true });
            message.success('Image URL updated successfully!');
            setImageUrl(values.imageUrl);
            form.resetFields();
        } catch (error) {
            message.error('Failed to update image URL');
        }
    };

    const handleImageUpload = async () => {
        if (fileList.length > 0) {
            const file = fileList[0].originFileObj;
            const storageRef = storage.ref(`filler/${restaurantId}/${file.name}`);
            try {
                await storageRef.put(file);
                const url = await storageRef.getDownloadURL();
                await firestore.collection('restaurants').doc(restaurantId).collection('filler').doc('imageData').set({
                    imageUrl: url,
                    timestamp: new Date()
                }, { merge: true });
                message.success('Image uploaded and URL updated successfully!');
                setImageUrl(url);
                setFileList([]);
            } catch (error) {
                message.error('Upload failed:', error);
            }
        } else {
            message.error('No file selected for upload');
        }
    };

    return (
        <Layout className="layout">
            <Header style={{ position: 'fixed', zIndex: 1, width: '100%', backgroundColor: 'white' }}>
                <div className="logo">
                    <span>DesiChowrastha Menu Filler</span>
                </div>
            </Header>
            <Content style={{ padding: '0 50px', marginTop: 64, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 'calc(100vh - 128px)' }}>
                <div style={{ width: '100%', maxWidth: 600, textAlign: 'center' }}>
                    <h2>Image Upload</h2>
                    <Image
                        width={200}
                        src={imageUrl || 'https://www.freeiconspng.com/thumbs/no-image-icon/no-image-icon-15.png'}
                        alt="Preview"
                    />
                    <Form form={form} layout="vertical" onFinish={handleUrlSubmit}>
                    <Form.Item name="imageTitle" label="Title" rules={[{ required: true, message: 'Please input the Title !' }]}>
                            <Input placeholder="Enter image title here" />
                        </Form.Item>
                        <Form.Item name="imageUrl" label="Image URL" rules={[{ required: true, message: 'Please input the image URL!' }]}>
                            <Input placeholder="Enter image URL here" />
                        </Form.Item>
                        <Button type="primary" htmlType="submit">
                            {imageUrl ? "Update Image URL" : "Save Image URL"}
                        </Button>
                    </Form>
                    <h6 style={{ marginTop: "8px" }}>or</h6>
                    <Upload
                        fileList={fileList}
                        beforeUpload={() => false}
                        onChange={onFileChange}
                        onRemove={onRemove}
                        accept="image/*"
                    >
                        <Button icon={<UploadOutlined />}>Select Image</Button>
                    </Upload>
                    <Button
                        type="primary"
                        onClick={handleImageUpload}
                        disabled={fileList.length === 0}
                        style={{ marginTop: 16 }}
                    >
                        Upload Image
                    </Button>
                </div>
            </Content>
            <Footer style={{ textAlign: 'center', position: 'fixed', width: '100%', bottom: 0, backgroundColor: 'white' }}>
                ©2024 DesiChowrastha | {restaurantId}
            </Footer>
        </Layout>
    );
};

export default FillerComponent;